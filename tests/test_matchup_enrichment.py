import importlib.util
from pathlib import Path
import unittest

PATH = Path("custom_components/espn_fantasy/model.py")
SPEC = importlib.util.spec_from_file_location("espn_fantasy_model_matchup", PATH)
model = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(model)


def player(pid, name, team_id, slot=0):
    return {
        "playerId": pid,
        "lineupSlotId": slot,
        "playerPoolEntry": {
            "player": {
                "id": pid,
                "fullName": name,
                "defaultPositionId": 1,
                "proTeamId": team_id,
                "eligibleSlots": [slot, 20],
                "stats": [],
            }
        },
    }


class MatchupEnrichmentTests(unittest.TestCase):
    def test_every_scoreboard_matchup_has_rosters_projection_probability_and_progress(self):
        data = {
            "scoringPeriodId": 4,
            "status": {"currentScoringPeriod": 4, "currentMatchupPeriod": 4},
            "teams": [
                {"id": 1, "name": "Alpha", "roster": {"entries": [player(101, "Alpha QB", 1)]}},
                {"id": 2, "name": "Beta", "roster": {"entries": [player(201, "Beta QB", 2)]}},
                {"id": 3, "name": "Gamma", "roster": {"entries": [player(301, "Gamma QB", 3)]}},
                {"id": 4, "name": "Delta", "roster": {"entries": [player(401, "Delta QB", 4)]}},
            ],
            "current_matchup": [
                {
                    "id": 11, "matchupPeriodId": 4,
                    "home": {"teamId": 1, "totalPointsLive": 88.2, "totalProjectedPointsLive": 121.4, "winProbability": .64,
                             "rosterForCurrentScoringPeriod": {"entries": [player(101, "Alpha QB", 1)]}},
                    "away": {"teamId": 2, "totalPointsLive": 79.1, "totalProjectedPointsLive": 113.8, "winProbability": .36,
                             "rosterForCurrentScoringPeriod": {"entries": [player(201, "Beta QB", 2)]}},
                },
                {
                    "id": 12, "matchupPeriodId": 4,
                    "home": {"teamId": 3, "totalPointsLive": 90.0, "totalProjectedPointsLive": 119.0, "winProbability": .55,
                             "rosterForCurrentScoringPeriod": {"entries": [player(301, "Gamma QB", 3)]}},
                    "away": {"teamId": 4, "totalPointsLive": 85.0, "totalProjectedPointsLive": 116.0, "winProbability": .45,
                             "rosterForCurrentScoringPeriod": {"entries": [player(401, "Delta QB", 4)]}},
                },
            ],
            "pro_team_schedules": [
                {"id": 1, "abbrev": "ATL", "proGamesByScoringPeriod": {"4": [{"id": 1001, "homeProTeamId": 1, "awayProTeamId": 2, "status": {"type": {"state": "in"}}}]}},
                {"id": 2, "abbrev": "BUF", "proGamesByScoringPeriod": {"4": [{"id": 1001, "homeProTeamId": 1, "awayProTeamId": 2, "status": {"type": {"state": "in"}}}]}},
                {"id": 3, "abbrev": "CHI", "proGamesByScoringPeriod": {"4": [{"id": 1002, "homeProTeamId": 3, "awayProTeamId": 4, "status": {"type": {"state": "pre"}}}]}},
                {"id": 4, "abbrev": "CIN", "proGamesByScoringPeriod": {"4": [{"id": 1002, "homeProTeamId": 3, "awayProTeamId": 4, "status": {"type": {"state": "pre"}}}]}},
            ],
        }
        games = model.build_normalized_model(data, 1)["league"]["scoreboard"]
        self.assertEqual(2, len(games))
        other = next(game for game in games if game["home_team_id"] == 3)
        self.assertEqual(119.0, other["home_projected_score"])
        self.assertEqual(.55, other["home_win_probability"])
        self.assertEqual("Gamma", other["home_team"]["team_name"])
        self.assertEqual("Delta", other["away_team"]["team_name"])
        self.assertEqual(1, len(other["home_team"]["starters"]))
        self.assertEqual(1, other["home_starters_remaining"])
        self.assertEqual(0, other["home_starters_playing"])

    def test_live_game_fields_are_exposed_on_players(self):
        data = {
            "scoringPeriodId": 4,
            "status": {"currentScoringPeriod": 4, "currentMatchupPeriod": 4},
            "teams": [{"id": 1, "name": "Alpha", "roster": {"entries": [player(101, "Alpha QB", 1)]}},
                      {"id": 2, "name": "Beta", "roster": {"entries": []}}],
            "current_matchup": [{"id": 11, "matchupPeriodId": 4,
                "home": {"teamId": 1, "rosterForCurrentScoringPeriod": {"entries": [player(101, "Alpha QB", 1)]}},
                "away": {"teamId": 2, "rosterForCurrentScoringPeriod": {"entries": []}}}],
            "pro_team_schedules": [
                {"id": 1, "abbrev": "ATL", "proGamesByScoringPeriod": {"4": [{
                    "id": 1001, "homeProTeamId": 1, "awayProTeamId": 2,
                    "homeScore": 17, "awayScore": 14, "period": 3, "displayClock": "8:42",
                    "possessionProTeamId": 1, "status": {"type": {"state": "in", "shortDetail": "8:42 - 3rd"}},
                }]}},
                {"id": 2, "abbrev": "BUF"},
            ],
        }
        p = model.build_normalized_model(data, 1)["matchup"]["my_team"]["roster"][0]
        self.assertEqual("in_progress", p["game_status"])
        self.assertEqual(3, p["game_period"])
        self.assertEqual("8:42", p["game_clock"])
        self.assertEqual("ATL", p["possession_abbrev"])
        self.assertEqual(17.0, p["home_score"])
        self.assertEqual(14.0, p["away_score"])


if __name__ == "__main__":
    unittest.main()
