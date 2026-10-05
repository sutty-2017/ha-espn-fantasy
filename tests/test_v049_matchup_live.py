import importlib.util
from pathlib import Path
import unittest


def load_model():
    path = Path("custom_components/espn_fantasy/model.py")
    spec = importlib.util.spec_from_file_location("espn_fantasy_model_v049", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class V049ModelTests(unittest.TestCase):
    def test_all_league_matchups_include_projection_probability_and_rosters(self):
        model = load_model()
        def player(pid, team, status="scheduled", actual=0, projected=10):
            return {
                "playerId": pid, "lineupSlotId": 2,
                "playerPoolEntry": {"player": {
                    "id": pid, "fullName": f"Player {pid}", "defaultPositionId": 2,
                    "proTeamId": team,
                    "stats": [
                        {"scoringPeriodId": 5, "statSourceId": 0, "statSplitTypeId": 1, "appliedTotal": actual},
                        {"scoringPeriodId": 5, "statSourceId": 1, "statSplitTypeId": 1, "appliedTotal": projected},
                    ],
                }},
            }
        teams = [
            {"id": i, "name": f"Team {i}", "roster": {"entries": [player(i * 100, i)]}}
            for i in range(1, 5)
        ]
        schedule = [
            {"id": 1, "matchupPeriodId": 5,
             "away": {"teamId": 1, "totalPointsLive": 55, "totalProjectedPointsLive": 101.2, "winProbability": .61,
                      "rosterForCurrentScoringPeriod": {"entries": [player(100, 1)]}},
             "home": {"teamId": 2, "totalPointsLive": 50, "totalProjectedPointsLive": 96.4, "winProbability": .39,
                      "rosterForCurrentScoringPeriod": {"entries": [player(200, 2)]}}},
            {"id": 2, "matchupPeriodId": 5,
             "away": {"teamId": 3, "totalPointsLive": 44, "totalProjectedPointsLive": 88.8, "winProbability": .45,
                      "rosterForCurrentScoringPeriod": {"entries": [player(300, 3)]}},
             "home": {"teamId": 4, "totalPointsLive": 48, "totalProjectedPointsLive": 92.1, "winProbability": .55,
                      "rosterForCurrentScoringPeriod": {"entries": [player(400, 4)]}}},
        ]
        data = {"scoringPeriodId": 5, "status": {"currentScoringPeriod": 5, "currentMatchupPeriod": 5},
                "teams": teams, "current_matchup": schedule, "pro_team_schedules": []}
        scoreboard = model.build_normalized_model(data, 1)["league"]["scoreboard"]
        self.assertEqual(len(scoreboard), 2)
        self.assertEqual(scoreboard[1]["away_team_name"], "Team 3")
        self.assertEqual(scoreboard[1]["away_projected_score"], 88.8)
        self.assertEqual(scoreboard[1]["home_win_probability"], .55)
        self.assertEqual(scoreboard[1]["away_team"]["roster"][0]["name"], "Player 300")
        self.assertIsNotNone(scoreboard[1]["away_starters_remaining"])

    def test_live_game_state_normalizes_score_clock_period_and_possession(self):
        model = load_model()
        pro = {
            1: {"id": 1, "abbrev": "SEA", "proGamesByScoringPeriod": {"5": [{
                "id": 77, "homeProTeamId": 1, "awayProTeamId": 2,
                "status": {"type": {"state": "in"}},
                "period": 3, "displayClock": "8:42", "homeScore": 17, "awayScore": 14,
                "possessionProTeamId": 1,
            }]}},
            2: {"id": 2, "abbrev": "SF"},
        }
        info = model._game_info(1, 5, pro)
        self.assertEqual(info["game_status"], "in_progress")
        self.assertEqual(info["game_period"], 3)
        self.assertEqual(info["game_clock"], "8:42")
        self.assertEqual(info["home_score"], 17.0)
        self.assertEqual(info["away_score"], 14.0)
        self.assertEqual(info["possession_abbrev"], "SEA")


if __name__ == "__main__":
    unittest.main()
