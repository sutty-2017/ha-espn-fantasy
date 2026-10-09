"""Coordinator update behavior with fake ESPN responses; never contacts HA/ESPN."""
from copy import deepcopy
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from test_coordinator_resilience import _load_coordinator_module
from test_model_optimization import model, season_fixture


def coordinator(module):
    entry = SimpleNamespace(data={'season': 2026, 'league_id': 123, 'team_id': 1})
    return module.ESPNDataUpdateCoordinator(None, entry)


def client(data):
    fake = SimpleNamespace(get_league=AsyncMock(side_effect=lambda: deepcopy(data)))
    for method in ('get_player_history_many', 'get_player_biographies_many',
                   'get_player_status_many', 'get_player_details_many',
                   'get_player_news_many'):
        setattr(fake, method, AsyncMock(return_value={}))
    return fake


class CoordinatorOptimizationTests(unittest.IsolatedAsyncioTestCase):
    async def test_duplicate_ids_and_roster_turnover_are_bounded(self):
        module = _load_coordinator_module()
        instance = coordinator(module)
        data = season_fixture(2, 2)
        entries = data['teams'][0]['roster']['entries']
        entries.append(deepcopy(entries[0]))
        data['transactions'] = [None, {'items': None}, {'items': 'bad'},
            {'items': [None, {'playerId': 100}, {'playerId': '100'}, {'playerId': 'bad'}]}]
        instance.client = client(data)
        with patch.object(module, 'build_normalized_model', model.build_normalized_model):
            result = await instance._async_update_data()
            instance.data = result
            instance.client.get_player_history_many.assert_awaited_once_with([100, 101], 4)
            instance.client.get_player_biographies_many.assert_awaited_once_with([100, 101])
            instance.client.get_player_news_many.assert_awaited_once_with([100, 101])
            instance.client.get_player_status_many.assert_awaited_once_with([100, 101])
            instance.client.get_player_details_many.assert_awaited_once_with([100])
            self.assertEqual(len(result['teams'][0]['roster']['entries']), 3)
            # Seed dropped-player cache entries; all must be removed on refresh.
            for name in ('_player_history', '_player_news', '_player_status', '_player_biographies'):
                getattr(instance, name)[999] = [] if name in ('_player_history', '_player_news') else {}
            for _ in range(3):
                instance.data = await instance._async_update_data()
            for name in ('_player_history', '_player_news', '_player_status', '_player_biographies'):
                self.assertNotIn(999, getattr(instance, name))

    async def test_live_refresh_preserves_news_and_recovers(self):
        module = _load_coordinator_module()
        instance = coordinator(module)
        player = {'id': 100, 'game_id': 123, 'game_status': 'in_progress'}
        instance.data = {'normalized': {'scoring_period': 4, 'matchup_period': 4,
            'matchup': {'my_team': {'roster': [player], 'starters': [player]}}}}
        original = deepcopy(instance.data)
        instance._player_news = {100: [{'headline': 'news'}]}
        instance._last_full_refresh = 1000
        instance._serving_stale_data = True
        instance.client = SimpleNamespace(get_live_matchup=AsyncMock(return_value={'schedule': [{'id': 'live'}]}))
        def rebuild(data, team_id):
            fresh = deepcopy(original['normalized'])
            return fresh
        with patch.object(module.time, 'monotonic', return_value=1060), patch.object(module, 'build_normalized_model', rebuild):
            result = await instance._async_update_data()
        self.assertFalse(instance._serving_stale_data)
        self.assertEqual(instance.update_interval.total_seconds(), 60)
        self.assertEqual(instance.data, original)
        for collection in ('roster', 'starters'):
            row = result['normalized']['matchup']['my_team'][collection][0]
            self.assertEqual(row['news'], [{'headline': 'news'}])
        self.assertEqual(result['current_matchup'], [{'id': 'live'}])
        instance.client.get_live_matchup.assert_awaited_once_with(4, 4)

    async def test_video_fetching_and_caches_are_removed(self):
        module = _load_coordinator_module()
        instance = coordinator(module)
        self.assertFalse(hasattr(instance, '_nfl_highlights'))
        self.assertFalse(hasattr(instance, '_nfl_highlights_updated'))
        data = season_fixture(2, 2)
        instance.client = client(data)
        instance.client.get_nfl_highlights_many = AsyncMock(side_effect=AssertionError('Video fetching is disabled'))
        with patch.object(module, 'build_normalized_model', model.build_normalized_model):
            result = await instance._async_update_data()
        instance.client.get_nfl_highlights_many.assert_not_awaited()
        self.assertNotIn('team_highlights', result)
        self.assertTrue(all('highlights' not in row for row in result['normalized']['matchup']['my_team']['roster']))
