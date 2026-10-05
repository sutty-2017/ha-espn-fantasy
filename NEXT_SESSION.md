# Maintainer / agent handoff

## Release state

- Release candidate: **v0.1.49**
- Base: published/tested **v0.1.48** Fantasy-only release with bounded diagnostics.
- Pick'em remains removed and out of scope unless the maintainer explicitly reopens it.
- Working branch: `work/v0.1.49-live-game-state`.

## v0.1.49 scope

- Preserve the coordinator's last known-good Fantasy data when a later ESPN request fails transiently, preventing entities/cards from becoming unavailable during temporary ESPN outages.
- Initial setup failures still raise `UpdateFailed`; stale data is served only after a successful dataset already exists.
- Normalize richer NFL game state for players when ESPN supplies it: quarter/period, clock, game detail, possession, home/away abbreviations and score.
- Expose the richer game-state fields on player entities for Home Assistant automations.
- Keep the compact LIVE badge, with live game context alongside it on player tiles.
- Add a dedicated Live Game section to the shared player popup with score, period/clock, and possession.
- Enrich every current league matchup with normalized home/away team detail so Scoreboard/Schedule matchup drill-downs can show the same useful context as the configured team's matchup.
- Matchup views show actual score, projected final score, starters done/live/left, and ESPN-provided win probability.
- Win probability is rendered as a compact ESPN-style horizontal probability line/bar; it is omitted when ESPN does not provide probability.
- Added permanent coordinator regression coverage for last-good-data behavior.

## Stable baseline retained

v0.1.48 fixed diagnostics downloads by replacing the multi-megabyte coordinator dump with bounded Fantasy-focused diagnostics. Keep that diagnostics design intact.

Existing Fantasy features remain: League/All-in-One sections, roster, standings, scoreboard, matchup, news, activity, waivers, schedule, playoff bracket, player/team/matchup popups, unified ticker, News card, historical stats, biographies, injury badges, lineup advice, adaptive live polling, and automation-facing sensors.

## Direction

Keep the project focused on ESPN Fantasy Football for the remainder of the 2026 season. Favor stability, real-world league compatibility, and existing feature polish over new ESPN competition types. Larger Game Day/intelligence ideas remain tabled for next year.

## Workflow

Use the established release flow:
**stable release → real-world HA testing → collect feedback → design/discuss → concentrated implementation/validation → release candidate → CI → PR/merge → maintainer publishes → verify release checkpoint → post-release handoff update**.

For meaningful Home Assistant framework/API changes, add targeted lifecycle/behavior regression tests rather than relying only on syntax or AST checks.
