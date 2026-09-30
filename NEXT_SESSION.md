# Maintainer / agent handoff

## Release state

- Published stable release: **v0.1.36**
- Published tag: **v0.1.36**
- Exact published release commit: **cc8b6888fd20b135fc19f95552fea25b747c83f6**
- Release PR: **#12** (squash-merged)
- Release branch: **dev/v0.1.36-bugfixes**
- The published tag was verified **identical** to the exact merged release commit (ahead 0 / behind 0).
- Pre-merge release gates passed: **Frontend validation, Hassfest, HACS validation**.
- Tagged manifest and frontend card version are both **0.1.36**.
- This handoff update is post-release housekeeping on main; do not move the v0.1.36 tag to include it.

## v0.1.36 published scope

### Traditional waiver budget fix
- Real v0.1.35 diagnostics showed ESPN can expose `acquisitionBudget: 100` even when the league is `WAIVERS_TRADITIONAL` and `isUsingAcquisitionBudget: false`.
- Per-team `budget_spent` / `budget_remaining` are now populated only when the league is positively identified as using FAB/FAAB/acquisition budget.
- Traditional waiver-order leagues therefore no longer display the bogus **100 left** value.
- Regression coverage reproduces the diagnostic combination explicitly.

### Pre-playoff Consolation Ladder projection
- v0.1.35 fetched postseason segment data defensively, but before ESPN publishes actual postseason matchup rows the standings fallback projected only the Championship Bracket.
- When ESPN settings say the consolation ladder is enabled, the standings fallback now adds a **Consolation Ladder** section directly below the projected Championship Bracket.
- Actual ESPN postseason tier data continues to take precedence once available.
- Regression coverage verifies an enabled consolation ladder is exposed by the pre-playoff projection.

### All-in-One Playoffs navigation fix
- The bracket scroll-state variable was initialized as a number while Playoffs later treated it as a per-section object.
- Leaving Playoffs could therefore throw before another All-in-One section rendered, making the card appear stuck until a browser refresh.
- Bracket scroll state is now initialized consistently as an object so normal section navigation continues after viewing Playoffs.

### NFL-team watermark visibility
- Player NFL-team background watermark opacity increased from **0.075** to **0.12**.
- The watermark remains deliberately subtle and behind player content.
- Existing watermark toggles/default behavior are unchanged.

## Validation completed

1. Frontend validation passed on the final release branch, including JavaScript/Python syntax, version matching and all smoke tests.
2. Added regression tests for the exact traditional-waiver dormant-budget case and enabled pre-playoff Consolation Ladder projection; both passed.
3. Hassfest passed.
4. HACS validation passed.
5. Manifest/frontend versions are both **0.1.36**.
6. PR #12 was squash-merged to main at **cc8b6888fd20b135fc19f95552fea25b747c83f6**.
7. Published tag **v0.1.36** was verified identical to that exact release commit.

## Current phase: real Home Assistant testing

Focus testing on:
- Waivers: confirm traditional waiver order shows ranks/teams with no budget or **100 left** text.
- Playoffs: confirm Championship Bracket and projected Consolation Ladder both appear before ESPN publishes real postseason rows.
- All-in-One navigation: enter Playoffs, move to several other sections, return to Playoffs, and verify no refresh is required.
- Watermark: judge the new 0.12 opacity in player popup and ticker Players on actual dashboard themes/displays.
- Activity wording for real lineup changes: Started, Benched and slot-to-slot roster moves.
- First real trade payload available for validating grouped trade rendering.
- Biography population/collapse behavior.
- Existing Schedule and adaptive 60-second live-polling behavior for regressions.

## Known caveats

- ESPN Fantasy endpoints, postseason segments/tier names, transaction payloads and athlete profile endpoints are unofficial/undocumented; normalization remains defensive.
- The Consolation Ladder is a standings-based projection until ESPN supplies actual postseason tier matchups.
- Biography fields vary by player and ESPN may omit fields.
- Real-world trade payload validation remains desirable because trades are comparatively infrequent.
- The 60-second live path from v0.1.34 still requires continued real-game observation.
- Existing Player and Game Active entity lifecycle is based on roster entities created at setup/reload; dynamic roster entity lifecycle remains a future audit item.

## Version direction

Remain on **0.1.x** for stabilization/refinement through the rest of the 2026 season unless scope becomes meaningfully architectural. Larger fantasy-intelligence/Game Day concepts remain tabled until next year after proving full-season/offseason resilience.

## Workflow

Use the established release flow:
**release candidate → CI → PR/merge → maintainer publishes → verify exact tag/main + post-release checks → real-world HA testing → collect feedback → next concentrated cycle**.
