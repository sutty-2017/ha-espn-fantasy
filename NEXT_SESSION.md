# Maintainer / agent handoff

## Release state

- Release candidate: **v0.1.50**
- Base: **v0.1.49** live-game/matchup release on top of the v0.1.48 bounded-diagnostics Fantasy baseline.
- Pick'em remains intentionally removed.
- v0.1.50 is a focused cleanup patch from a fresh review of the v0.1.49 release state.

## v0.1.50 scope

- Restore Playoff Bracket Round 1/2/3 jump controls in compact and expanded bracket views while keeping postseason tiers aligned during horizontal navigation.
- Expose whether the coordinator is serving stale last-known-good data in diagnostics.
- Keep the full v0.1.49 live-game, matchup enrichment, win-probability, and transient-ESPN resilience work unchanged.
- Keep frontend/Python validation, HACS, and Hassfest green before merge.

## Stable Fantasy baseline retained

v0.1.50 retains the v0.1.49 live-game/matchup improvements and v0.1.48 compact diagnostics and the v0.1.41-era Fantasy card/data feature baseline: League/All-in-One, Ticker, Player, Team, Matchup, News, standings, scoreboard, roster, schedule, playoff brackets, waivers, activity, biographies, history, outlooks, injury/lineup advice, adaptive live polling, and automation-facing sensors.

## Direction

Keep the project focused on ESPN Fantasy Football for the remainder of the 2026 season. Favor stability, real-world league compatibility, and existing feature polish over new ESPN competition types. Pick'em stays out unless explicitly reopened.

## Workflow

Use the established release flow:
**stable release → real-world HA testing → collect feedback → design/discuss → concentrated implementation/validation → release candidate → CI → PR/merge → maintainer publishes → verify release checkpoint → post-release handoff update**.

For meaningful Home Assistant framework/API changes, add targeted lifecycle/behavior regression tests rather than relying only on syntax or AST checks.
