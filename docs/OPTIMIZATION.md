# v0.1.53 optimization and validation

## What changed

The league model previously rebuilt the same player stats, weekly history, season summary, and game details for every appearance in the season schedule, scoreboard, team roster list, and configured matchup. The new model shares those read-only nested values within a single build. Each appearance still has its own player dictionary, its own lineup advice, and its own team score/projection/probability fields.

Reuse keys include both the original roster entry and its canonical enrichment entry. Different matchup lineup placements and live stats remain distinct. The cache is local to `build_normalized_model` and is discarded when that build returns; it cannot accumulate players between refreshes or reuse an earlier week.

Roster and transaction IDs are deduplicated before enrichment calls. Existing roster/news/history/status/biography cache cleanup remains in place. Fantasy endpoints and refresh intervals are unchanged.

At the maintainer's request, NFL video highlights are removed from the API client, coordinator, and cards. There are no video enrichment requests, game-video caches, matching passes, playlists, playback handlers, or Highlights editor settings. Text news remains. Legacy sensor `highlights` attributes return empty lists, and old card YAML highlight options are harmlessly ignored. Successful live polling clears the stale-data indicator.

Diagnostics summarize transactions and matchup rosters, bound strings, dictionary widths, list samples, and nested depth, and preserve explicit credential redaction. Limits apply within diagnostic sections rather than to the outer export structure, so useful counts and sample fields remain accessible. Teams and schedules are sampled before constructing summary lists. Diagnostic limits do not trim sensor/card data.

## Reproducible measurements

Measured in the development container with Python 3.12 against main commit `586283581e4bd768337eb9bc063f0963bbd38d88`. This synthetic fixture contains 10 fantasy teams, 16 players each, 18 scoring weeks with actual/projected stat rows, 90 season matchups, and separate current-matchup roster payloads.

| Model build | Baseline | Optimized |
| --- | ---: | ---: |
| Median wall time, 5 builds | 77.72 ms | 29.51 ms |
| Retained traced allocations | 12,587,040 bytes | 3,968,976 bytes |
| Peak traced allocations | 12,596,000 bytes | 4,260,776 bytes |
| Serialized normalized JSON | 13,573,596 bytes | 13,573,596 bytes |

The complete normalized dictionaries and serialized JSON are identical to the baseline in this benchmark. Retained allocations fell approximately 68%, peak allocations 66%, and build time 62%. These are model-build measurements, not process RSS, Home Assistant Green measurements, or expected system-wide savings. Distinct historical matchup rosters offer less reuse than canonical roster fallbacks.

Reproduce with:

```sh
python tests/benchmark_normalization.py
```

To compare against a baseline source file:

```sh
git show 586283581e4bd768337eb9bc063f0963bbd38d88:custom_components/espn_fantasy/model.py > /tmp/espn-baseline-model.py
python tests/benchmark_normalization.py --baseline /tmp/espn-baseline-model.py
```

## Regression coverage

The 23-test suite covers complete cached/uncached model equality, input immutability, fixture compatibility, matchup-specific lineup placement, independent enrichment writes and advice, scores/projections/probabilities/starter progress, live game fields, refresh/week changes, empty rosters/no matchup, duplicate IDs, malformed transaction items, repeated cache cleanup, live news retention, removal of video fetching/caches, stale-data recovery/failure behavior, and bounded/redacted diagnostics including wide dictionaries.

```sh
python -m unittest discover -s tests -v
python -m compileall -q custom_components/espn_fantasy
node --check custom_components/espn_fantasy/www/espn-fantasy-cards.js
node tests/test_frontend_no_video.js
```

Every shell validation step in `frontend.yml` and `espn-static-checks.yml` also passes locally. CI now runs the entire test suite when tests change. The frontend workflow's previously escaped newline text was corrected so each intended card-registration check runs separately.

Coordinator tests execute actual coordinator update methods with fake ESPN clients and minimal Home Assistant framework stubs. Model tests execute actual normalization code. This is not an installed Home Assistant integration test or an authenticated ESPN refresh. Frontend runtime tests execute the card module with minimal custom-element registration stubs and verify that legacy video settings/data cannot render videos, while news and player popups still render. Existing card/editor registrations remain intact. Only the video feature is intentionally removed; legacy sensor highlight keys remain as empty lists.

## Scope and practical limits

This candidate optimizes the in-memory model and processing while preserving Fantasy dashboard and automation compatibility. Video highlights are the explicit maintainer-requested exception. JSON serialization expands shared references, so large state attributes, WebSocket payloads, and Recorder's attribute-size warnings can remain. Addressing those further would need a separately designed data transport/compatibility change. No claim is made that this fixes Home Assistant memory crashes.

No live Home Assistant settings, dashboards, integration files, or add-ons were modified. The candidate is prepared on PR #36's branch; merging and publishing remain maintainer decisions. After approval, normal installation and observation in Home Assistant are still needed to measure real-world behavior.

## v0.1.54: compact transport and startup correction

The live v0.1.53 inspection found approximately 19.2 million JSON characters in the league entity, including 16.4 million in its schedule. The proposed compact transport addresses this separate serialization cost without forcing a schema change on existing consumers.

Compact mode is opt-in through the integration options flow, defaults off, and reloads the integration after saving. Legacy exports keep their existing structure. Compact exports add `payload_format: compact_v1` and a `player_details` dictionary; team sides replace player lists with `roster_refs` and `starter_refs`. The bundled cards resolve those references only when rendering a popup. Historical matchup-specific placement, stats, advice, and per-side totals stay distinct. A refresh-local identity signature includes every player field; shared nested data can be reused without confusing different top-level advice or placement. The normalized coordinator model itself is unchanged. The league sensor caches one compact export for the current normalized league and replaces it on the next refresh; disabling the option clears that cache.

The serialized fixture league shrinks from **13,442,025 to 1,058,305 bytes (92.1%)**, including every player detail needed for a lossless round trip. Actual card markup matches between compact and legacy data for all 90 schedule games, 5 scoreboard games, both starter/bench modes, 10 roster popups, and 160 player-detail popups. A runtime test also invokes a compact schedule popup's player-click listener and verifies the selected player data. The Python suite has 31 tests, including options defaults/persistence, export cache reuse/replacement/restoration, and event-loop registration behavior. Lifecycle/options tests use minimal HA API doubles rather than a live installation.

```sh
python -m unittest discover -s tests -v
python tests/benchmark_compact_transport.py --fixture /tmp/espn-compact-fixture.json
node tests/test_compact_frontend.js /tmp/espn-compact-fixture.json
```

The startup listener is now an async function and re-enters the existing registration guard instead of creating an untracked duplicate retry task. The observed daily-puzzle thread warning belongs to a separate integration and is outside this fix.

Before enabling compact mode, load the v0.1.54 card bundle by refreshing the dashboard. External templates and third-party cards that traverse the old nested player paths should keep legacy mode or be adapted explicitly. Roster/matchup/player sensor schemas remain unchanged. Recorder size warnings can remain even in compact mode. Real-world Core/host RAM savings remain unmeasured.
