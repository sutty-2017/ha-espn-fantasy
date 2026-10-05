import importlib.util
import unittest
from pathlib import Path

MODEL_PATH = Path("custom_components/espn_fantasy/model.py")
spec = importlib.util.spec_from_file_location("espn_fantasy_model_v049", MODEL_PATH)
model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)

def entry(pid, name, pro_team, slot=0):
    return {"playerId": pid, "lineupSlotId": slot, "playerPoolEntry": {"player": {"id": pid, "fullName": name, "defaultPositionId": 1, "proTeamId": pro_team, "stats": []}}}

class V049FeatureTests(unittest.TestCase):
    def test_all_league_matchups_include_projection_probability_and_roster_state(self):
        teams = [
            {"id": 1, "name": "Alpha", "roster": {"entries": [entry(11, "A One", 1)]}},
            {"id": 2, "name": "Beta", "roster": {"entries": [entry(22, "B One", 2)]}},
            {"id": 3, "name": "Gamma", "roster": {"entries": [entry(33, "C One", 3)]}},
            {"id": 4, "name": "Delta", "roster": {"entries": [entry(44, "D One", 4)]}},
        ]
        games = [
            {"id": 101, "matchupPeriodId": 4, "home": {"teamId": 1, "totalPointsLive": 70, "totalProjectedPointsLive": 112.5, "winProbability": .65}, "away": {"teamId": 2, "totalPointsLive": 68, "totalProjectedPointsLive": 106.2, "winProbability": .35}},
            {"id": 102, "matchupPeriodId": 4, "home": {"teamId": 3, "totalPointsLive": 80, "totalProjectedPointsLive": 121.1, "winProbability": .72}, "away": {"teamId": 4, "totalPointsLive": 61, "totalProjectedPointsLive": 99.8, "winProbability": .28}},
        ]
        data = {"scoringPeriodId": 4, "status": {"currentScoringPeriod": 4, "currentMatchupPeriod": 4}, "teams": teams, "current_matchup": games, "season_schedule": games, "pro_team_schedules": []}
        league = model.build_normalized_model(data, 1)["league"]
        self.assertEqual(len(league["scoreboard"]), 2)
        other = next(g for g in league["scoreboard"] if g["id"] == 102)
        self.assertEqual(other["home_projected_score"], 121.1)
        self.assertEqual(other["away_win_probability"], .28)
        self.assertEqual(other["home_team"]["team_name"], "Gamma")
        self.assertEqual(other["away_team"]["team_name"], "Delta")
        self.assertEqual(len(other["home_team"]["roster"]), 1)

    def test_live_game_state_is_normalized_on_player(self):
        data = {
            "scoringPeriodId": 4, "status": {"currentScoringPeriod": 4, "currentMatchupPeriod": 4},
            "teams": [{"id": 1, "name": "Alpha", "roster": {"entries": [entry(11, "A One", 1)]}}, {"id": 2, "name": "Beta", "roster": {"entries": []}}],
            "current_matchup": [{"id": 101, "matchupPeriodId": 4, "home": {"teamId": 1}, "away": {"teamId": 2}}],
            "pro_team_schedules": [
                {"id": 1, "abbrev": "ATL", "proGamesByScoringPeriod": {"4": [{"id": 77, "homeProTeamId": 1, "awayProTeamId": 2, "status": {"type": {"state": "in", "shortDetail": "3rd - 8:42"}}, "period": 3, "displayClock": "8:42", "homeScore": 17, "awayScore": 14, "possessionProTeamId": 1}]}},
                {"id": 2, "abbrev": "BUF", "proGamesByScoringPeriod": {"4": []}},
            ],
        }
        player = model.build_normalized_model(data, 1)["matchup"]["my_team"]["roster"][0]
        self.assertEqual(player["game_status"], "in_progress")
        self.assertEqual(player["game_period"], 3)
        self.assertEqual(player["game_clock"], "8:42")
        self.assertEqual(player["home_score"], 17.0)
        self.assertEqual(player["away_score"], 14.0)
        self.assertEqual(player["possession_abbrev"], "ATL")

if __name__ == "__main__":
    unittest.main()
