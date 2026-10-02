from __future__ import annotations

import asyncio
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


def _load_diagnostics_module():
    """Load diagnostics.py with minimal Home Assistant/package stubs."""
    root = Path(__file__).resolve().parents[1] / "custom_components" / "espn_fantasy"

    ha = types.ModuleType("homeassistant")
    ha_components = types.ModuleType("homeassistant.components")
    ha_diagnostics = types.ModuleType("homeassistant.components.diagnostics")
    ha_diagnostics.async_redact_data = lambda data, keys: {
        key: ("**REDACTED**" if key in keys else value)
        for key, value in data.items()
    }
    ha_config_entries = types.ModuleType("homeassistant.config_entries")
    ha_config_entries.ConfigEntry = object
    ha_core = types.ModuleType("homeassistant.core")
    ha_core.HomeAssistant = object
    ha_helpers = types.ModuleType("homeassistant.helpers")
    ha_aiohttp = types.ModuleType("homeassistant.helpers.aiohttp_client")
    ha_aiohttp.async_get_clientsession = lambda hass: object()

    package = types.ModuleType("custom_components.espn_fantasy")
    package.__path__ = [str(root)]
    const = types.ModuleType("custom_components.espn_fantasy.const")
    const.CONF_ESPN_S2 = "espn_s2"
    const.CONF_SWID = "swid"
    const.DOMAIN = "espn_fantasy"
    pickem = types.ModuleType("custom_components.espn_fantasy.pickem")
    pickem.pickem_entry_summary = lambda payload: {
        "payload_type": "object",
        "structure": {"keys": sorted(payload)},
    }
    pickem_api = types.ModuleType("custom_components.espn_fantasy.pickem_api")
    pickem_api.ESPNPickemClient = object

    stubs = {
        "homeassistant": ha,
        "homeassistant.components": ha_components,
        "homeassistant.components.diagnostics": ha_diagnostics,
        "homeassistant.config_entries": ha_config_entries,
        "homeassistant.core": ha_core,
        "homeassistant.helpers": ha_helpers,
        "homeassistant.helpers.aiohttp_client": ha_aiohttp,
        "custom_components.espn_fantasy": package,
        "custom_components.espn_fantasy.const": const,
        "custom_components.espn_fantasy.pickem": pickem,
        "custom_components.espn_fantasy.pickem_api": pickem_api,
    }
    old = {name: sys.modules.get(name) for name in stubs}
    sys.modules.update(stubs)
    try:
        spec = importlib.util.spec_from_file_location(
            "custom_components.espn_fantasy.diagnostics", root / "diagnostics.py"
        )
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        return module
    finally:
        for name, value in old.items():
            if value is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = value


class DiagnosticsTests(unittest.IsolatedAsyncioTestCase):
    async def test_pickem_timeout_does_not_block_base_diagnostics(self):
        diagnostics = _load_diagnostics_module()

        class SlowClient:
            def __init__(self, *args, **kwargs):
                pass

            async def get_entry(self, entry_id):
                await asyncio.sleep(1)
                return {"never": "returned"}

        entry = SimpleNamespace(
            entry_id="entry-1",
            title="Test league",
            data={"season": 2026, "league_id": 1, "team_id": 7},
            options={"pickem_entry_id": "configured-id"},
        )
        coordinator = SimpleNamespace(
            last_update_success=True,
            data={"normalized": {"capabilities": {}}},
        )
        hass = SimpleNamespace(data={"espn_fantasy": {"entry-1": coordinator}})

        with (
            patch.object(diagnostics, "ESPNPickemClient", SlowClient),
            patch.object(diagnostics, "PICKEM_DIAGNOSTIC_TIMEOUT", 0.01),
        ):
            result = await asyncio.wait_for(
                diagnostics.async_get_config_entry_diagnostics(hass, entry),
                timeout=0.25,
            )

        self.assertEqual(result["pickem_probe"]["status"], "timeout")
        self.assertEqual(result["compatibility"]["season"], 2026)
        json.dumps(result)

    async def test_pickem_success_is_included_and_serializable(self):
        diagnostics = _load_diagnostics_module()

        class FastClient:
            def __init__(self, *args, **kwargs):
                pass

            async def get_entry(self, entry_id):
                return {"id": entry_id, "picks": []}

        entry = SimpleNamespace(
            entry_id="entry-1",
            title="Test league",
            data={"season": 2026, "league_id": 1, "team_id": 7},
            options={"pickem_entry_id": "configured-id"},
        )
        coordinator = SimpleNamespace(
            last_update_success=True,
            data={"normalized": {"capabilities": {"schedule": True}}},
        )
        hass = SimpleNamespace(data={"espn_fantasy": {"entry-1": coordinator}})

        with patch.object(diagnostics, "ESPNPickemClient", FastClient):
            result = await diagnostics.async_get_config_entry_diagnostics(hass, entry)

        self.assertEqual(result["pickem_probe"]["status"], "ok")
        self.assertNotIn("entry_id", result["pickem_probe"])
        json.dumps(result)


if __name__ == "__main__":
    unittest.main()
