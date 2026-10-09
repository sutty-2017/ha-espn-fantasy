"""Execute frontend registration on an event loop with fake HA resources."""
import ast
import asyncio
import inspect
import logging
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock

SOURCE = Path(__file__).resolve().parents[1] / 'custom_components/espn_fantasy/__init__.py'


def load_functions():
    tree = ast.parse(SOURCE.read_text())
    nodes = [n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name in ('_async_register_frontend', '_async_reload_options')]
    scope = {'asyncio': asyncio, 'HomeAssistant': object, 'ConfigEntry': object,
        '_LOGGER': logging.getLogger('test.frontend'), '_CARD_PATH': SimpleNamespace(exists=lambda: True),
        '_ICON_PATH': '/icon', '_CARD_STATIC_URL': '/cards.js', '_ICON_STATIC_URL': '/icon',
        '_CARD_URL': '/cards.js?v=test', 'LOVELACE_DATA': 'lovelace',
        'EVENT_HOMEASSISTANT_STARTED': 'started', 'StaticPathConfig': lambda *a, **kw: (a, kw)}
    exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), str(SOURCE), 'exec'), scope)
    return scope


class FrontendLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_start_listener_is_async_and_does_not_duplicate_registration(self):
        scope = load_functions()
        tasks, listeners = [], []
        resources = SimpleNamespace(async_items=lambda: [], async_update_item=AsyncMock(), async_create_item=AsyncMock())
        hass = SimpleNamespace(data={'lovelace': SimpleNamespace(resources=resources)},
            http=SimpleNamespace(async_register_static_paths=AsyncMock()),
            bus=SimpleNamespace(async_listen_once=lambda event, cb: listeners.append(cb)))
        def create_task(coro):
            task = asyncio.create_task(coro)
            tasks.append(task)
            return task
        hass.async_create_task = create_task
        register = scope['_async_register_frontend']
        await register(hass)
        self.assertEqual(len(listeners), 1)
        self.assertTrue(inspect.iscoroutinefunction(listeners[0]))
        await listeners[0](None)  # Initial task is still pending: no second task.
        self.assertEqual(len(tasks), 1)
        await tasks[0]
        await asyncio.sleep(0)  # Run the task cleanup callback.
        await listeners[0](None)  # Already registered: no second static/resource call.
        await register(hass)
        self.assertEqual(len(tasks), 1)
        hass.http.async_register_static_paths.assert_awaited_once()
        resources.async_create_item.assert_awaited_once()
        self.assertNotIn('espn_fantasy_frontend_task', hass.data)

    async def test_option_update_reloads_only_its_entry(self):
        scope = load_functions()
        reload = AsyncMock()
        hass = SimpleNamespace(config_entries=SimpleNamespace(async_reload=reload))
        await scope['_async_reload_options'](hass, SimpleNamespace(entry_id='espn-one'))
        reload.assert_awaited_once_with('espn-one')
