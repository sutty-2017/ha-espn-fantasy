# Maintainer / agent handoff

## Release state

- Published stable release: **v0.1.31**
- Current release candidate: **v0.1.32**
- Development branch: `dev/post-v0.1.31-fixes`
- Do not merge or publish until the v0.1.32 validation checks are green and real Home Assistant testing is acceptable.

This file is intended to be sufficient context for a new maintainer or AI coding agent to resume work without access to the development chat.

## v0.1.32 scope completed on the branch

### Historical stats and injury normalization

A v0.1.31 Home Assistant diagnostic proved that ESPN's canonical team roster already contained Weeks 1–3 history and current injury fields, while the normalized matchup model was using a separate current-period roster copy and losing that information.

The staged fix merges the canonical roster player payload with the current matchup roster entry. Canonical history/injury metadata is retained while current lineup placement and exact current-week matchup stat rows still win where appropriate. A regression smoke test covers this path.

### League Activity enrichment

- Transaction player IDs are resolved through a focused ESPN player lookup, including free agents/recently dropped players not present on the configured roster.
- Activity items expose friendly player name, headshot, position, NFL team, injury status, and a normalized player payload.
- Fantasy team logo/name are normalized into Activity.
- FAAB remains supported but is displayed only for a meaningful positive bid.
- Transactions expose team-oriented `sides` with players sent/received.
- Trade detection is normalized with `is_trade`.

### Activity UI

- All-in-One Activity rows and ticker Activity items are tappable.
- Activity ticker items are wider than ordinary player/matchup tiles while retaining the ticker row height.
- Activity event count uses the existing `story_count` convention; the unified ticker now exposes that count setting too.
- Activity scroll position is preserved when switching All-in-One sections.
- Simple add/drop or waiver popup:
  - one fantasy-team logo/name across the top;
  - DROPPED and ADDED player columns beneath it;
  - one-player transactions collapse to one column.
- Trade popup:
  - team-oriented left/right columns;
  - each column has that fantasy team's logo/name;
  - players are grouped as SENT/RECEIVED under the appropriate team.
- Transaction player details reuse the shared player-details renderer for stats/history and any other available shared details.

### Home Assistant entity / automation audit

Three focused sensors were added rather than forcing users to discover all important state inside nested attributes:

1. **League Activity**
   - state: latest human-readable transaction description;
   - attributes: transaction identity/type/status/time, team identity, trade flag, bid, rich items, team-oriented sides, and 10 recent events.
2. **Lineup Recommendations**
   - state: number of actionable starter/bench projection recommendations;
   - attributes: starter, replacement, projections and projected improvement.
3. **Injured Players**
   - state: count of roster players with a meaningful ESPN injury designation;
   - attributes: affected players and statuses.

Existing League/Roster/Matchup/Player attributes remain for compatibility and advanced automations.

A full new-user data map was added at **`docs/ENTITIES.md`**, listing every provided sensor/binary sensor and the important attributes tucked inside each one. README links to it.

### Project documentation

README is updated for v0.1.32 and preserves the personal-use/at-your-own-risk and ChatGPT/OpenAI AI-assisted-development disclosure already added to main.

## Validation / release gate

Still required before publishing v0.1.32:

1. Frontend validation:
   - JavaScript syntax;
   - Python compile;
   - manifest/frontend version match;
   - existing card registration checks.
2. Regression smoke tests:
   - league scoreboard;
   - history and lineup advice;
   - canonical roster enrichment;
   - add/drop Activity normalization;
   - trade side normalization;
   - automation-facing sensor markers.
3. Hassfest.
4. HACS validation.
5. Real Home Assistant / ESPN testing after the candidate is available:
   - Weeks 1–3 history appears again;
   - injury badges appear wherever shared player rendering is used;
   - Activity free-agent names/photos/position/NFL team resolve;
   - fantasy team logos display;
   - simple add/drop popup layout is correct;
   - trade popup layout is correct when a real trade payload is available;
   - ticker Activity width works at compact/standard/large/XL;
   - new League Activity, Lineup Recommendations, and Injured Players sensors appear and expose expected attributes.

## Known caveats

- ESPN Fantasy endpoints and transaction payloads are unofficial/undocumented; real-league payload validation remains important.
- Transaction players receive the rich metadata/stats returned by the focused ESPN player endpoint. News is still fetched only for the configured current roster, so a free-agent transaction player may not have news in the shared popup.
- Existing Player and Game Active entities are created from the roster present during integration setup/reload; dynamic roster entity lifecycle deserves a future audit but is not part of the v0.1.32 release gate.
- The development branch was created before the README disclosure commit on main. The branch README was rebuilt from the current main README so the disclosure text is preserved, but Git history is currently one commit behind main until the release branch is reconciled/merged.

## Release workflow

Once checks are green:
1. Resolve any branch/main merge issue if GitHub reports one.
2. Review the PR diff and workflow results.
3. Squash merge the release PR.
4. Verify `manifest.json` and frontend `CARD_VERSION` are both 0.1.32 on main.
5. Publish tag/release `v0.1.32`.
6. After publication, update this handoff for the published release checkpoint so another maintainer/agent can start from the exact stable state.
