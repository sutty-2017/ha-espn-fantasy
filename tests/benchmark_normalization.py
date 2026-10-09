"""Reproduce synthetic model-build costs without contacting ESPN or HA.

Run: python tests/benchmark_normalization.py [--baseline /path/to/model.py]
Without --baseline, compare refresh-local reuse to the same model with reuse disabled.
"""
import argparse
import gc
import importlib.util
import json
from statistics import median
import time
import tracemalloc
from unittest.mock import patch

from test_model_optimization import model, season_fixture


def measure(build):
    timings = []
    for _ in range(5):
        gc.collect()
        started = time.perf_counter()
        result = build()
        timings.append(time.perf_counter() - started)
        del result
    gc.collect()
    tracemalloc.start()
    result = build()
    retained, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return result, {'median_ms': round(median(timings) * 1000, 2),
                    'retained_bytes': retained, 'peak_bytes': peak}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline')
    args = parser.parse_args()
    data = season_fixture()
    if args.baseline:
        spec = importlib.util.spec_from_file_location('baseline_model', args.baseline)
        baseline = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(baseline)
        old, old_cost = measure(lambda: baseline.build_normalized_model(data, 1))
    else:
        original = model._side
        def uncached(side, team, period, pro_teams, player_cache=None):
            return original(side, team, period, pro_teams)
        with patch.object(model, '_side', uncached):
            old, old_cost = measure(lambda: model.build_normalized_model(data, 1))
    new, new_cost = measure(lambda: model.build_normalized_model(data, 1))
    assert old == new, 'Normalized output changed'
    encoded = json.dumps(new)
    assert json.dumps(old) == encoded, 'Serialized output changed'
    print(json.dumps({'fixture': '10 teams, 16 players/team, 18 weeks, distinct current-matchup rosters',
        'baseline': old_cost, 'optimized': new_cost, 'serialized_bytes': len(encoded.encode()),
        'output_equal': True}, indent=2))


if __name__ == '__main__':
    main()
