from __future__ import annotations

import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from types import SimpleNamespace


def _load_diagnostics_module():
    root = Path(__file__).resolve().parents[1] / "custom_components" / "espn_fantasy"
    stubs = {}

    diagnostics_module = types.ModuleType("homeassistant.components.diagnostics")
    diagnostics_module.async_redact_data = lambda data, keys: {
        key: ("**REDACTED**" if key in keys else value)
        for key, value in data.items()
    }
    stubs["homeassistant"] = types.ModuleType("homeassistant")
    stubs["homeassistant.components"] = types.ModuleType("homeassistant.components")
    stubs["homeassistant.components.diagnostics"] = diagnostics_module
    stubs["homeassistant.config_entries"] = types.ModuleType("homeassistant.config_entries")
    stubs["homeassistant.config_entries"].ConfigEntry = object
    stubs["homeassistant.core"] = types.ModuleType("homeassistant.core")
    stubs["homeassistant.core"].HomeAssistant = object

    package = types.ModuleType("custom_components.espn_fantasy")
    package.__path__ = [str(root)]
    stubs["custom_components.espn_fantasy"] = package
    const = types.ModuleType("custom_components.espn_fantasy.const")
    const.CONF_ESPN_S2 = "espn_s2"
    const.CONF_SWID = "swid"
    const.DOMAIN = "espn_fantasy"
    stubs["custom_components.espn_fantasy.const"] = const

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
    async def test_large_raw_payload_is_bounded_and_serializable(self):
        diagnostics = _load_diagnostics_module()
        huge_player = {"id": 1, "stats": [{"blob": "x" * 100_000}]}
        huge_roster = {"entries": [{"playerPoolEntry": {"player": huge_player}}] * 50}
        teams = [
            {
                "id": team_id,
                "name": f"Team {team_id}",
                "owners": ["private-owner-id"],
                "roster": huge_roster,
                "record": {"overall": {"wins": 3, "losses": 1}},
            }
            for team_id in range(1, 11)
        ]
        schedule = [
            {
                "id": index,
                "matchupPeriodId": index,
                "home": {"teamId": 1, "rosterForCurrentScoringPeriod": huge_roster},
                "away": {"teamId": 2, "rosterForCurrentScoringPeriod": huge_roster},
            }
            for index in range(1, 18)
        ]
        coordinator = SimpleNamespace(
            last_update_success=True,
            data={
                "status": {"currentScoringPeriod": 4},
                "settings": {"name": "Test League"},
                "teams": teams,
                "current_matchup": schedule[:5],
                "season_schedule": schedule,
                "transactions": [{"id": i} for i in range(100)],
                "player_news": {"huge": "y" * 1_000_000},
                "normalized": {
                    "scoring_period": 4,
                    "matchup_period": 4,
                    "capabilities": {"schedule": True},
                    "league": {
                        "standings": [{"team_id": i} for i in range(10)],
                        "scoreboard": [],
                        "schedule": [],
                        "schedule_periods": [4],
                        "playoff_bracket": {},
                        "waivers": {},
                        "activity": [{"id": i} for i in range(100)],
                    },
                    "matchup": {"my_team": {"roster": [{"id": 1, "name": "Player"}]}},
                },
            },
        )
        entry = SimpleNamespace(
            entry_id="entry-1",
            title="Test League",
            data={
                "season": 2026,
                "league_id": 123,
                "team_id": 7,
                "espn_s2": "secret",
                "swid": "secret",
            },
        )
        hass = SimpleNamespace(data={"espn_fantasy": {"entry-1": coordinator}})

        result = await diagnostics.async_get_config_entry_diagnostics(hass, entry)
        encoded = json.dumps(result)

        self.assertLess(len(encoded), 100_000)
        self.assertNotIn("x" * 1000, encoded)
        self.assertNotIn("y" * 1000, encoded)
        self.assertNotIn("private-owner-id", encoded)
        self.assertEqual(result["entry"]["data"]["espn_s2"], "**REDACTED**")
        self.assertEqual(len(result["coordinator"]["raw"]["transactions"]), 25)
        self.assertEqual(len(result["coordinator"]["normalized"]["league"]["activity"]), 25)


if __name__ == "__main__":
    unittest.main()
