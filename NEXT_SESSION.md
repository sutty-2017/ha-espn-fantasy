# Maintainer / agent handoff

## Release state

- Release candidate: **v0.1.47**
- Purpose: remove the abandoned ESPN Pick'em experiment and restore the stable Fantasy-only runtime.
- Stable Fantasy baseline restored from **v0.1.41** commit `90c836c98e6da77e065366bf095100218abaffa8`.
- v0.1.42 through v0.1.46 were experimental Pick'em diagnostics/configuration attempts and are intentionally superseded by v0.1.47.
- Do not resume Pick'em work unless the maintainer explicitly reopens the idea.

## v0.1.47 scope

- Removed `pickem.py`, `pickem_api.py`, Pick'em research documentation, and Pick'em-specific tests.
- Removed the experimental Pick'em OptionsFlow/configuration field.
- Restored Home Assistant diagnostics to the v0.1.41 Fantasy-only implementation.
- Restored CI workflow content to the v0.1.41 Fantasy regression suite, removing Pick'em-specific guards.
- Fantasy cards, sensors, coordinator behavior, ESPN Fantasy API behavior, schedule/playoff handling, activity, waivers, news, biographies, and lineup advice remain at the proven v0.1.41 baseline.
- Version is advanced to v0.1.47 so HACS can upgrade cleanly from the published experimental releases without rewriting Git history.

## Stable Fantasy feature baseline

v0.1.41 includes:
- readable Waiver Order team names and roster drill-down
- editor free-text focus fix
- optional combined Standings + Scoreboard Overview with internal ordering
- Schedule League/My Team views and matchup drill-downs
- complete postseason presentation with Championship, Winners Consolation, and Consolation paths
- roster/matchup lineup-advice badges
- league Activity and transaction popups
- player biographies, historical stats, outlooks, injury badges, and news
- adaptive focused live polling
- compatibility/resilience diagnostics and fixture coverage
- automation-facing Activity, Lineup Recommendations, and Injured Players sensors.

## Direction

Keep the project focused on ESPN Fantasy Football for the remainder of the 2026 season. Favor stability, real-world league compatibility, and existing feature polish over new ESPN competition types. Larger multi-competition/Pick'em architecture is no longer active scope.

## Workflow

Use the established release flow:
**stable release → real-world HA testing → collect feedback → design/discuss → concentrated implementation/validation → release candidate → CI → PR/merge → maintainer publishes → verify release checkpoint → post-release handoff update**.

For meaningful Home Assistant framework/API changes, add targeted lifecycle/behavior regression tests rather than relying only on syntax or AST checks.
