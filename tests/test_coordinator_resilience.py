from __future__ import annotations

import asyncio
import importlib.util
import sys
import types
import unittest
from unittest.mock import AsyncMock, patch
from pathlib import Path
from types import SimpleNamespace


def _load_coordinator_module():
    root = Path(__file__).resolve().parents[1] / "custom_components" / "espn_fantasy"
    stubs = {}
    for name in (
        "homeassistant", "homeassistant.config_entries", "homeassistant.core",
        "homeassistant.helpers", "homeassistant.helpers.aiohttp_client",
        "homeassistant.helpers.update_coordinator",
    ):
        stubs[name] = types.ModuleType(name)
    stubs["homeassistant.config_entries"].ConfigEntry = object
    stubs["homeassistant.core"].HomeAssistant = object
    stubs["homeassistant.helpers.aiohttp_client"].async_get_clientsession = lambda hass: None

    class UpdateFailed(Exception):
        pass

    class DataUpdateCoordinator:
        def __init__(self, *args, **kwargs):
            self.data = None
            self.last_update_success = True
        @classmethod
        def __class_getitem__(cls, item):
            return cls

    stubs["homeassistant.helpers.update_coordinator"].DataUpdateCoordinator = DataUpdateCoordinator
    stubs["homeassistant.helpers.update_coordinator"].UpdateFailed = UpdateFailed

    package = types.ModuleType("custom_components.espn_fantasy")
    package.__path__ = [str(root)]
    stubs["custom_components.espn_fantasy"] = package
    api = types.ModuleType("custom_components.espn_fantasy.api")
    class ESPNError(Exception):
        pass
    class ESPNClient:
        def __init__(self, *args, **kwargs):
            pass
    api.ESPNError, api.ESPNClient = ESPNError, ESPNClient
    stubs["custom_components.espn_fantasy.api"] = api
    const = types.ModuleType("custom_components.espn_fantasy.const")
    for key, value in {
        "CONF_ESPN_S2":"espn_s2", "CONF_LEAGUE_ID":"league_id", "CONF_SEASON":"season",
        "CONF_SWID":"swid", "CONF_TEAM_ID":"team_id", "DEFAULT_SCAN_INTERVAL":300,
        "LIVE_SCAN_INTERVAL":60, "DOMAIN":"espn_fantasy",
    }.items():
        setattr(const, key, value)
    stubs["custom_components.espn_fantasy.const"] = const
    model = types.ModuleType("custom_components.espn_fantasy.model")
    model.build_normalized_model = lambda data, team_id: data.get("normalized", {})
    stubs["custom_components.espn_fantasy.model"] = model

    old = {name: sys.modules.get(name) for name in stubs}
    sys.modules.update(stubs)
    try:
        spec = importlib.util.spec_from_file_location(
            "custom_components.espn_fantasy.coordinator", root / "coordinator.py"
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


class CoordinatorResilienceTests(unittest.IsolatedAsyncioTestCase):
    async def test_transient_espn_failure_keeps_last_good_data(self):
        module = _load_coordinator_module()
        coordinator = object.__new__(module.ESPNDataUpdateCoordinator)
        coordinator.data = {"normalized": {"matchup": None}, "marker": "last-good"}
        coordinator._last_full_refresh = 0.0
        coordinator._serving_stale_data = False
        coordinator.entry = SimpleNamespace(data={"team_id": 1})

        class Client:
            async def get_league(self):
                raise module.ESPNError("temporary ESPN failure")

        coordinator.client = Client()
        result = await coordinator._async_update_data()
        self.assertIs(result, coordinator.data)
        self.assertEqual(result["marker"], "last-good")
        self.assertTrue(coordinator._serving_stale_data)
        second = await coordinator._async_update_data()
        self.assertIs(second, coordinator.data)
        self.assertTrue(coordinator._serving_stale_data)

    async def test_focused_live_recovery_clears_stale_state(self):
        module = _load_coordinator_module()
        coordinator = object.__new__(module.ESPNDataUpdateCoordinator)
        coordinator.data = {
            "normalized": {
                "scoring_period": 5, "matchup_period": 5,
                "matchup": {"my_team": {"roster": [{"game_status": "in_progress"}]}, "opponent": {}},
            }
        }
        coordinator._last_full_refresh = 100.0
        coordinator._serving_stale_data = True
        coordinator._player_news = {}
        coordinator.entry = SimpleNamespace(data={"team_id": 1})
        coordinator.client = SimpleNamespace(
            get_live_matchup=AsyncMock(return_value={"schedule": []})
        )
        with patch.object(module.time, "monotonic", return_value=101.0):
            result = await coordinator._async_update_data()
        self.assertEqual(result["live_scoring"], {"schedule": []})
        self.assertFalse(coordinator._serving_stale_data)

    async def test_initial_espn_failure_still_marks_update_failed(self):
        module = _load_coordinator_module()
        coordinator = object.__new__(module.ESPNDataUpdateCoordinator)
        coordinator.data = None
        coordinator._last_full_refresh = 0.0
        coordinator._serving_stale_data = False
        coordinator.entry = SimpleNamespace(data={"team_id": 1})

        class Client:
            async def get_league(self):
                raise module.ESPNError("initial failure")

        coordinator.client = Client()
        with self.assertRaises(module.UpdateFailed):
            await coordinator._async_update_data()


if __name__ == "__main__":
    unittest.main()
