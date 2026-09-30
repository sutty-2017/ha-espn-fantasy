# Maintainer / agent handoff

## Release state

- Published stable release: **v0.1.38**
- Published tag: **v0.1.38**
- Exact merged release commit: **71f91e009ac9d8808b25bd6646cd509fcc1d393f**
- Release PR: **#14** (squash-merged)
- Release branch: **dev/v0.1.38-fixes**
- Pre-merge release gates passed: **Frontend validation, Hassfest, HACS validation**.
- Manifest and frontend card version are both **0.1.38**.
- The maintainer confirmed v0.1.38 was posted after the merge.
- This handoff update is post-release housekeeping on main; do not move the v0.1.38 tag to include it.

## v0.1.38 hotfix

- Fixes the v0.1.37 setup regression: ESPN may return HTTP 200 but omit `schedule` for the optional whole-season `mSchedule` enrichment request.
- That sparse optional response now degrades to an empty `season_schedule` rather than failing integration setup.
- Core league, roster, and current-matchup structural validation remains strict.
- Added an explicit regression check for the sparse optional season-schedule path.
- The full existing frontend, Python, normalization, fixture, polling, sensor, Hassfest, and HACS validation suite passed before merge.
- Treat **v0.1.38** as the new stable baseline.

## v0.1.37 published scope

### League compatibility / resilience
- Added a normalized league capability profile derived from ESPN settings.
- Unknown ESPN lineup-slot IDs are preserved with stable fallback labels such as `Slot 27` instead of being silently lost or mislabelled.
- Critical ESPN HTTP-200 responses now receive structural validation so sparse/malformed responses fail with clearer context.
- Home Assistant diagnostics now include a compatibility summary covering league capabilities and optional-data availability.
- Added a sanitized fixture format and first traditional-waiver/unknown-slot regression fixture.
- CI now executes compatibility fixtures alongside the existing smoke-test suite.
- README includes guidance for testing additional league formats without sharing ESPN authentication cookies or member data.

### Complete postseason presentation
- Postseason sections are presented in ESPN-style order:
  1. Championship Bracket
  2. Winners Consolation Ladder
  3. Consolation Ladder
- Winners Consolation remains visible with projected **TBD** placeholders before ESPN supplies that tier's actual matchup rows.
- Existing ESPN-provided postseason data continues to take precedence when available.

### Lineup-advice badges
- Projection-based lineup recommendations are presented as portrait-anchored badges in the actual **Roster** and **My Matchup** sections.
- Lower-projected starter: orange **−** badge.
- Qualifying higher-projected bench player: green **+** badge.
- Roster and Matchup have independent lineup-advice toggles and continue to respect the configured projection-difference threshold.
- Drill-down popup rosters/matchups intentionally do not add these badges merely because they reuse the same visual components.

### Standings and Scoreboard drill-downs
- Standings teams can open a roster-style popup for that fantasy team.
- Scoreboard games can open a matchup-style popup for those two teams.
- Matchup drill-down supports Starters and Bench / IR views.
- Team headers can drill into the selected team's roster.
- Player rows can drill into existing player details.
- Navigation uses **one modal with an internal Back stack**, avoiding stacked dialogs.
- Standings roster popups and Scoreboard matchup popups have independent editor toggles, defaulting on.
- League sensor exposes one normalized `team_rosters` collection for all fantasy teams; Scoreboard rows continue to reference teams by ID rather than duplicating full rosters into every game.

## Validation completed

1. Frontend validation passed on the final release head.
2. JavaScript syntax passed.
3. Python syntax passed.
4. Manifest/frontend/cache version parity passed at **0.1.37**.
5. League scoreboard normalization passed.
6. Expanded schedule/postseason normalization passed.
7. History and lineup-advice regression passed.
8. Canonical roster enrichment passed.
9. League activity normalization passed.
10. Compatibility fixture tests passed.
11. Adaptive live-polling checks passed.
12. Automation-facing sensor checks passed.
13. Required card registration checks passed.
14. Hassfest passed.
15. HACS validation passed.
16. PR #13 was squash-merged to main at **452c2531d6f3e1e2513b28eed81eb27a16c26d40**.
17. Maintainer subsequently posted **v0.1.37**.

## Current phase: real Home Assistant testing

Treat v0.1.38 as the new stable baseline. Collect additional findings for the next concentrated release rather than modifying this published release.

Useful real-world checks:
- Confirm Championship → Winners Consolation → Consolation ordering and TBD behavior before ESPN publishes real postseason matchups.
- Validate actual postseason tier replacement once ESPN begins supplying matchup rows.
- Confirm orange − / green + badges identify the intended starter/bench pair in Roster and My Matchup.
- Exercise independent Roster/Matchup advice toggles and threshold behavior.
- Exercise Standings → roster → player and Scoreboard → matchup → team roster → player navigation, including Back behavior.
- Test drill-downs with multiple league teams and Bench / IR.
- Continue observing real lineup-change Activity wording and the first available real trade payload.
- Continue biography, Schedule and adaptive 60-second live-polling regression testing.
- Gather diagnostics from additional league formats when available: FAAB, Superflex, IDP, divisions, keeper, different playoff counts, etc.

## Known caveats

- ESPN Fantasy endpoints, postseason segments/tier names, transaction payloads and athlete profile endpoints are unofficial/undocumented; normalization remains defensive.
- Projected postseason paths are placeholders until ESPN supplies actual matchup data.
- Biography fields vary by player and ESPN may omit fields.
- Real-world trade payload validation remains desirable because trades are comparatively infrequent.
- The 60-second live path still benefits from continued real-game observation.
- Existing Player and Game Active entity lifecycle is based on roster entities created at setup/reload; dynamic roster entity lifecycle remains a future audit item.
- Compatibility fixtures are a foundation, not proof of every ESPN league format; continue adding sanitized real-world shapes as testers provide them.

## Version direction

Remain on **0.1.x** for stabilization/refinement through the rest of the 2026 season unless scope becomes meaningfully architectural. Larger fantasy-intelligence/Game Day concepts remain tabled until next year after proving full-season/offseason resilience.

## Workflow

Use the established release flow:
**stable release → real-world HA testing → collect feedback → design/discuss → concentrated implementation/validation → release candidate → CI → PR/merge → maintainer publishes → verify release checkpoint → post-release handoff update**.
