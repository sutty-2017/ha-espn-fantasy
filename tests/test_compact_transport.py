"""Lossless compact exports, legacy attributes, and refresh cache lifecycle."""
import ast
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from test_model_optimization import model, season_fixture

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'custom_components/espn_fantasy'
spec = importlib.util.spec_from_file_location('transport', SOURCE / 'transport.py')
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)


def expand(payload):
    result = {k: v for k, v in payload.items() if k not in ('player_details', 'payload_format')}
    def team(row):
        value = {k: v for k, v in row.items() if k not in ('roster_refs', 'starter_refs')}
        value['roster'] = [payload['player_details'][ref] for ref in row['roster_refs']]
        value['starters'] = [payload['player_details'][ref] for ref in row['starter_refs']]
        return value
    for collection in ('schedule', 'scoreboard'):
        result[collection] = []
        for game in payload[collection]:
            game = dict(game)
            for side in ('home_team', 'away_team'):
                if isinstance(game.get(side), dict):
                    game[side] = team(game[side])
            result[collection].append(game)
    result['team_rosters'] = [team(row) for row in payload['team_rosters']]
    return result


def sensor_class():
    tree = ast.parse((SOURCE / 'sensor.py').read_text())
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'LeagueSensor')
    class Base:
        def __init__(self, coordinator, *args):
            self.coordinator = coordinator
    scope = {'ESPNBaseSensor': Base, 'compact_league': transport.compact_league,
             'CONF_COMPACT_LEAGUE_DATA': 'compact_league_data',
             'CONF_LEAGUE_ID': 'league_id', 'CONF_SEASON': 'season'}
    exec(compile(ast.fix_missing_locations(ast.Module(body=[cls], type_ignores=[])), str(SOURCE / 'sensor.py'), 'exec'), scope)
    return scope['LeagueSensor'], scope


class CompactTransportTests(unittest.TestCase):
    def test_lossless_round_trip_and_large_payload_reduction(self):
        league = model.build_normalized_model(season_fixture(), 1)['league']
        before = deepcopy(league)
        compact = transport.compact_league(league)
        encoded = json.dumps(compact)
        decoded = expand(json.loads(encoded))
        self.assertEqual(decoded, json.loads(json.dumps(league)))
        self.assertEqual(league, before)
        self.assertLess(len(encoded), len(json.dumps(league)) * .25)
        self.assertEqual(len(compact['player_details']), 320)

    def test_distinct_lineup_advice_is_not_merged(self):
        a = {'id': 1, 'stats': {}, 'starter': True, 'lineup_alert': None}
        b = {**a, 'lineup_alert': 'lower_than_bench'}
        league = {'team_rosters': [{'roster': [a, b], 'starters': [a, b]}]}
        compact = transport.compact_league(league)
        self.assertEqual(len(compact['player_details']), 2)
        self.assertEqual(expand(compact)['team_rosters'], league['team_rosters'])

    def test_missing_teams_and_empty_rosters_round_trip(self):
        league = model.build_normalized_model(season_fixture(2, 0), 1)['league']
        self.assertEqual(expand(transport.compact_league(league)), league)

    def test_legacy_default_and_compact_cache_replace_on_refresh(self):
        cls, scope = sensor_class()
        data = season_fixture(2, 2)
        data['normalized'] = model.build_normalized_model(data, 1)
        entry = SimpleNamespace(data={'league_id': 123, 'season': 2026}, options={})
        coordinator = SimpleNamespace(data=data, entry=entry)
        sensor = cls(coordinator)
        legacy = sensor.extra_state_attributes
        self.assertNotIn('player_details', legacy)
        self.assertIs(legacy['schedule'], data['normalized']['league']['schedule'])
        entry.options = {'compact_league_data': True}
        with patch.dict(scope, compact_league=unittest.mock.Mock(wraps=transport.compact_league)):
            first = sensor.extra_state_attributes
            second = sensor.extra_state_attributes
            self.assertIs(first['player_details'], second['player_details'])
            self.assertEqual(scope['compact_league'].call_count, 1)
            data['normalized'] = model.build_normalized_model(season_fixture(2, 1), 1)
            latest = sensor.extra_state_attributes
            self.assertEqual(scope['compact_league'].call_count, 2)
            self.assertIsNot(first['player_details'], latest['player_details'])
            entry.options = {'compact_league_data': False}
            restored = sensor.extra_state_attributes
            self.assertNotIn('player_details', restored)
            self.assertIsNone(sensor._compact_export)
            self.assertIsNone(sensor._export_source)
