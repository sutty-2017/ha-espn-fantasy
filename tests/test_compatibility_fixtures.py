import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "custom_components" / "espn_fantasy" / "model.py"
FIXTURES = Path(__file__).parent / "fixtures"

spec = importlib.util.spec_from_file_location("espn_fantasy_model", MODEL)
model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)


class CompatibilityFixtureTests(unittest.TestCase):
    def test_traditional_waivers_and_unknown_slot_are_preserved(self):
        data = json.loads((FIXTURES / "traditional_waivers_unknown_slot.json").read_text())
        normalized = model.build_normalized_model(data, 1)
        capabilities = normalized["capabilities"]
        self.assertEqual(capabilities["acquisition_type"], "WAIVERS_TRADITIONAL")
        self.assertFalse(capabilities["uses_acquisition_budget"])
        self.assertTrue(capabilities["has_unknown_lineup_slots"])
        self.assertEqual(capabilities["unknown_lineup_slot_ids"], [27])
        self.assertEqual(capabilities["lineup_slot_counts"]["Slot 27"], 1)
        self.assertIsNone(normalized["league"]["waivers"]["acquisition_budget"])
        self.assertTrue(all(row["budget_remaining"] is None for row in normalized["league"]["waivers"]["order"]))
        self.assertEqual(len(normalized["league"]["team_rosters"]), 4)
        self.assertEqual(normalized["league"]["team_rosters"][0]["team_name"], "Alpha")
        self.assertEqual(normalized["league"]["team_rosters"][0]["roster"][0]["lineup_slot"], "Slot 27")
        self.assertEqual(normalized["league"]["scoreboard"][0]["home_team_name"], "Alpha")
        self.assertEqual(normalized["league"]["scoreboard"][0]["away_team_name"], "Beta")
        sections = normalized["league"]["playoff_bracket"]["sections"]
        self.assertEqual(
            [section["label"] for section in sections],
            ["Championship Bracket", "Winners Consolation Ladder"],
        )
        self.assertEqual(sections[1]["rounds"][0]["matches"][0]["home_team_name"], "TBD")


if __name__ == "__main__":
    unittest.main()
