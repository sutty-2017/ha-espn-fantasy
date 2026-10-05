# Maintainer / agent handoff

## Release state

- Release candidate: **v0.1.49**
- Base: published **v0.1.48** Fantasy-only release with bounded diagnostics.
- Pick'em remains intentionally removed.
- v0.1.49 is the current concentrated Fantasy polish/reliability release.

## v0.1.49 scope

- Preserve the coordinator's last known-good Fantasy payload through transient ESPN API failures instead of making entities/cards unavailable after a successful startup.
- Rich live NFL player game state: quarter/period, clock, NFL score, possession, and team abbreviations normalized into the shared player model and exposed on player entities.
- Compact live status remains available on player tiles; player detail popups gain a dedicated Live Game scoreboard section when a game is in progress.
- League-wide matchup normalization now includes both teams' complete normalized roster context, projected totals, ESPN win probability, and starter done/live/left counts.
- Scoreboard and Schedule matchup drill-downs use that enriched data for every fantasy team, not only the configured user's matchup.
- Matchup presentation includes an ESPN-style horizontal win-probability line with numeric percentages.
- Regression coverage added for league-wide matchup enrichment and live NFL game-state normalization.

## Stable Fantasy baseline retained

v0.1.49 retains v0.1.48 compact diagnostics and the v0.1.41-era Fantasy card/data feature baseline: League/All-in-One, Ticker, Player, Team, Matchup, News, standings, scoreboard, roster, schedule, playoff brackets, waivers, activity, biographies, history, outlooks, injury/lineup advice, adaptive live polling, and automation-facing sensors.

## Direction

Keep the project focused on ESPN Fantasy Football for the remainder of the 2026 season. Favor stability, real-world league compatibility, and existing feature polish over new ESPN competition types. Pick'em stays out unless explicitly reopened.

## Workflow

Use the established release flow:
**stable release → real-world HA testing → collect feedback → design/discuss → concentrated implementation/validation → release candidate → CI → PR/merge → maintainer publishes → verify release checkpoint → post-release handoff update**.

For meaningful Home Assistant framework/API changes, add targeted lifecycle/behavior regression tests rather than relying only on syntax or AST checks.
