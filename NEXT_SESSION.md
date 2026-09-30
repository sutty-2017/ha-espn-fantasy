# Maintainer / agent handoff

## Release state

- Published stable release: **v0.1.35**
- Published tag: **v0.1.35**
- Exact published release commit: **e1d828f19cef55e29177e4f94cfa87d7a738717d**
- Release PR: **#11** (squash-merged)
- Release branch: **dev/v0.1.35-waivers-bio-activity-brackets**
- The published tag was verified **identical** to the exact merged release commit.
- Pre-merge release gates passed: **Frontend validation, Hassfest, HACS validation**.
- Tagged manifest and frontend card version are both **0.1.35**.

## v0.1.35 published scope

### Postseason completeness
- Whole-season schedule remains the baseline.
- ESPN postseason segment schedules are fetched defensively and merged into it.
- Segment-specific metadata can enrich an existing matchup rather than being discarded solely because the matchup ID already exists.
- This specifically targets missing consolation/placement/ladder tiers while preserving the existing multi-section bracket model.

### Waivers
- League / All-in-One card adds an optional **Waivers** section.
- Backend exposes normalized waiver order and league acquisition context.
- Traditional leagues use **Waiver Order**.
- FAB/FAAB-style leagues use **FAB Tiebreaker** when ESPN settings identify budget-based acquisition.
- No-waiver leagues do not present a misleading waiver order.
- Configured team is highlighted; available budget context is shown when applicable.

### Player biography
- Relevant roster players receive cached ESPN NFL profile/biography enrichment on a long (24-hour) interval.
- Normalized biography can include height, weight, age/date of birth, birthplace, jersey, position, experience, college, draft details and team history when ESPN supplies them.
- Player popup has its own collapsible **Biography** section.
- Player card collapsed state remains unchanged; biography appears only inside the card's existing expanded area.
- Player sensor attributes expose biography data.

### NFL-team watermark
- Player tiles can render the player's current NFL team logo as a subtle background watermark.
- Watermarking is independently configurable and is available in player popup/card behavior and ticker Players presentation.
- Normalized player attributes expose the NFL team logo URL.

### Activity semantics
- ESPN LINEUP items are normalized as **Started**, **Benched**, or **Roster move** using from/to lineup slots.
- Slot transitions are retained in normalized Activity data.
- Add, drop and trade actions remain distinct.
- Existing grouped trade presentation is retained and enriched rather than replaced.

## Validation completed

1. Frontend validation passed.
2. Hassfest passed.
3. HACS validation passed.
4. Manifest/frontend versions are both **0.1.35**.
5. PR #11 was squash-merged to main at **e1d828f19cef55e29177e4f94cfa87d7a738717d**.
6. Published tag **v0.1.35** was verified identical to that exact release commit.
7. Real-world Home Assistant testing is the next phase.

## Current phase: real Home Assistant testing

Focus testing on:
- Consolation/ladder postseason sections that were missing in v0.1.34.
- Waiver order correctness and configured-team highlighting.
- Standard-vs-FAB labeling and budget context.
- Biography population, popup collapse behavior and Player-card expanded placement.
- NFL-team watermark appearance and independent toggles, especially ticker Players.
- Activity wording for real lineup changes: Started, Benched and slot-to-slot roster moves.
- First real trade payload available for validating grouped trade rendering.
- Existing v0.1.34 Schedule and adaptive live-polling behavior for regressions.

## Known caveats

- ESPN Fantasy endpoints, postseason segments/tier names, transaction payloads and athlete profile endpoints are unofficial/undocumented; normalization remains defensive.
- Biography fields vary by player and ESPN may omit fields.
- Real-world trade payload validation remains desirable because trades are comparatively infrequent.
- The 60-second live path from v0.1.34 still requires continued real-game observation.
- Existing Player and Game Active entity lifecycle is based on roster entities created at setup/reload; dynamic roster entity lifecycle remains a future audit item.

## Version direction

Remain on **0.1.x** for stabilization/refinement through the rest of the 2026 season unless scope becomes meaningfully architectural. Larger fantasy-intelligence/Game Day concepts remain tabled until next year after proving full-season/offseason resilience.

## Workflow

Use the established release flow:
**release candidate → CI → PR/merge → maintainer publishes → verify exact tag/main + post-release checks → real-world HA testing → collect feedback → next concentrated cycle**.
