# Maintainer / agent handoff

## Release state

- Release candidate: **v0.1.49**
- Working branch: `work/v0.1.49-live-game-state`
- Published baseline: **v0.1.48**
- Keep the project Fantasy Football-only; do not resume Pick'em unless the maintainer explicitly reopens it.

## v0.1.49 scope

- Rich live NFL game context is normalized onto players: quarter/period, clock, score, possession, and home/away identity when ESPN supplies it.
- Compact player surfaces keep a condensed live status; the player popup adds a dedicated Live Game mini-scoreboard only while a meaningful live game is available.
- League scoreboard matchup drill-downs now carry complete normalized home/away team context for every league matchup, including rosters, current score, projected final score, starters done/live/remaining, and ESPN win probability.
- Matchup presentation uses an ESPN-style horizontal win-probability line with numeric percentages.
- The configured-team Matchup card uses the same probability-bar treatment.
- Coordinator keeps serving the exact last known-good Fantasy data through transient ESPN API failures and clears degraded state after recovery, including focused live refresh recovery.
- v0.1.48 bounded diagnostics remain intact.

## Validation expectations before publish

- Run JS syntax validation and Python compilation.
- Run the full unittest suite, including v0.1.49 live-game/all-team-matchup regression coverage and bounded diagnostics.
- Verify coordinator transient-failure/recovery behavior with permanent regression coverage.
- Run Hassfest and HACS validation.
- Confirm manifest/frontend versions match 0.1.49.

## Workflow

Use the established release flow:
**stable release → real-world HA testing → collect feedback → design/discuss → concentrated implementation/validation → release candidate → CI → PR/merge → maintainer publishes → verify release checkpoint → post-release handoff update**.

For meaningful Home Assistant framework/API changes, keep targeted lifecycle/behavior regression tests rather than relying only on syntax or AST checks.
