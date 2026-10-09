"""Behavior and allocation regressions for refresh-local normalization reuse."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('optimized_model', ROOT / 'custom_components/espn_fantasy/model.py')
model = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(model)


def season_fixture(team_count=10, roster_size=16, weeks=18):
    teams = []
    for tid in range(1, team_count + 1):
        entries = []
        for index in range(roster_size):
            pid = tid * 100 + index
            entries.append({'playerId': pid, 'lineupSlotId': 0 if index < 8 else 20,
                'playerPoolEntry': {'player': {'id': pid, 'fullName': f'Player {pid}',
                    'defaultPositionId': 1, 'eligibleSlots': [0, 20], 'proTeamId': tid,
                    'stats': [{'seasonId': 2026, 'scoringPeriodId': week, 'statSourceId': source,
                        'statSplitTypeId': 1, 'appliedTotal': index + week + source,
                        'stats': {'3': 100 + week, '4': 2, '20': 1}}
                        for week in range(1, weeks + 1) for source in (0, 1)]}}})
        teams.append({'id': tid, 'name': f'Team {tid}', 'roster': {'entries': entries}})
    schedule = [{'id': week * 100 + tid, 'matchupPeriodId': week,
        'home': {'teamId': tid, 'totalPoints': week * 10, 'totalProjectedPoints': 120},
        'away': {'teamId': tid + 1, 'totalPoints': week * 11, 'totalProjectedPoints': 130}}
        for week in range(1, weeks + 1) for tid in range(1, team_count, 2)]
    current = deepcopy([game for game in schedule if game['matchupPeriodId'] == 4])
    for game in current:
        for key in ('home', 'away'):
            side = game[key]
            side['rosterForCurrentScoringPeriod'] = deepcopy(teams[side['teamId'] - 1]['roster'])
    # Matchup-specific placement must win over canonical placement.
    if current and roster_size:
        current[0]['home']['rosterForCurrentScoringPeriod']['entries'][0]['lineupSlotId'] = 20
    return {'teams': teams, 'season_schedule': schedule, 'current_matchup': current,
        'scoringPeriodId': 4, 'status': {'currentScoringPeriod': 4, 'currentMatchupPeriod': 4},
        'settings': {}, 'pro_team_schedules': []}


class ModelOptimizationTests(unittest.TestCase):
    def test_cached_and_uncached_models_are_identical(self):
        data = season_fixture()
        before = deepcopy(data)
        cached = model.build_normalized_model(data, 1)
        original = model._side
        def uncached(side, team, period, pro_teams, player_cache=None):
            return original(side, team, period, pro_teams)
        with patch.object(model, '_side', uncached):
            expected = model.build_normalized_model(data, 1)
        self.assertEqual(cached, expected)
        self.assertEqual(json.dumps(cached), json.dumps(expected))
        self.assertEqual(data, before)
        self.assertEqual(cached['matchup']['my_team']['roster'][0]['lineup_slot_id'], 20)

    def test_reuses_expensive_history_without_sharing_enrichment_writes(self):
        data = season_fixture()
        with patch.object(model, '_player', wraps=model._player) as normalize:
            result = model.build_normalized_model(data, 1)
        # 160 canonical entries + 160 distinct matchup entries. Schedule length
        # and repeated scoreboard/my-team uses must not add normalization work.
        self.assertEqual(normalize.call_count, 320)
        first, second = result['league']['schedule'][:2]
        self.assertIsNot(first['home_team']['roster'][0], second['home_team']['roster'][0])
        week1 = first['home_team']['roster'][0]
        week2 = result['league']['schedule'][5]['home_team']['roster'][0]
        self.assertIs(week1['weekly_history'], week2['weekly_history'])
        mine = result['matchup']['my_team']['roster'][0]
        scoreboard = result['league']['scoreboard'][0]['home_team']['roster'][0]
        mine['news'] = [{'headline': 'new'}]
        self.assertNotIn('news', scoreboard)
        self.assertEqual(first['home_team']['score'], 10)
        self.assertEqual(result['league']['schedule'][5]['home_team']['score'], 20)

    def test_refresh_and_week_changes_do_not_reuse_old_players(self):
        data = season_fixture(2, 2)
        old = model.build_normalized_model(data, 1)
        data['teams'][0]['roster']['entries'][0]['playerPoolEntry']['player']['fullName'] = 'Updated'
        data['scoringPeriodId'] = 5
        new = model.build_normalized_model(data, 1)
        self.assertEqual(new['matchup']['my_team']['roster'][0]['name'], 'Updated')
        self.assertNotEqual(old['matchup']['my_team']['roster'][0]['actual_points'],
                            new['matchup']['my_team']['roster'][0]['actual_points'])

    def test_lineup_advice_does_not_leak_between_different_rosters(self):
        data = season_fixture(2, 2)
        team = data['teams'][0]
        entries = team['roster']['entries']
        entries[1]['lineupSlotId'] = 20
        cache = {}
        both = model._side({'teamId': 1, 'rosterForCurrentScoringPeriod':
            {'entries': entries}}, team, 4, {}, cache)
        alone = model._side({'teamId': 1, 'rosterForCurrentScoringPeriod':
            {'entries': [entries[0]]}}, team, 4, {}, cache)
        self.assertEqual(both['roster'][0]['lineup_alert'], 'lower_than_bench')
        self.assertIsNone(alone['roster'][0]['lineup_alert'])

    def test_no_matchup_and_empty_rosters_keep_the_model_shape(self):
        data = season_fixture(2, 0)
        data['season_schedule'] = []
        data['current_matchup'] = []
        result = model.build_normalized_model(data, 1)
        self.assertIsNone(result['matchup'])
        self.assertEqual(len(result['league']['team_rosters']), 2)
        self.assertTrue(all(side['roster'] == [] for side in result['league']['team_rosters']))

    def test_existing_compatibility_fixture_is_identical_without_cache(self):
        for path in (ROOT / 'tests/fixtures').glob('*.json'):
            data = json.loads(path.read_text())
            original = model._side
            result = model.build_normalized_model(data, 1)
            with patch.object(model, '_side', lambda side, team, period, pro_teams, player_cache=None:
                              original(side, team, period, pro_teams)):
                self.assertEqual(result, model.build_normalized_model(data, 1))
