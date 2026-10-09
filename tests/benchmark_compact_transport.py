"""Compare serialized league transport and optionally export frontend fixtures."""
import argparse
import json
from pathlib import Path
from test_compact_transport import model, season_fixture, transport

parser = argparse.ArgumentParser()
parser.add_argument('--fixture')
args = parser.parse_args()
league = model.build_normalized_model(season_fixture(), 1)['league']
compact = transport.compact_league(league)
legacy_bytes = len(json.dumps(league).encode())
compact_bytes = len(json.dumps(compact).encode())
print(json.dumps({'legacy_bytes': legacy_bytes, 'compact_bytes': compact_bytes,
                  'reduction_percent': round(100 * (1 - compact_bytes / legacy_bytes), 1),
                  'distinct_player_details': len(compact['player_details'])}))
if args.fixture:
    Path(args.fixture).write_text(json.dumps({'legacy': league, 'compact': compact}))
