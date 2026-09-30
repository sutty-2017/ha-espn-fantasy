# Maintainer / agent handoff

## Release state

- Published stable release: **v0.1.32**
- Published tag: **v0.1.32**
- Exact release/main commit: **602659a88316e6bdff189ffa3b820b7793c27cd3**
- Release PR: **#8**
- Release validation: **Frontend validation, Hassfest, and HACS validation all passed**
- Next work should begin from this published checkpoint. Do not treat the old `dev/post-v0.1.31-fixes` branch as the new development base.

This file is intended to be sufficient context for a new maintainer or AI coding agent to resume work without access to the development chat.

## v0.1.32 published scope

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

## Published validation and live-test focus

The exact v0.1.32 release candidate passed Frontend validation, Hassfest, and HACS validation. The release tag points to the exact merged main commit listed above.

Real Home Assistant / ESPN testing after publication should focus on historical Weeks 1–3, injury badges, Activity player/team identity, add/drop and trade popups, ticker Activity sizing, and the new automation-facing sensors.

## Known caveats

- ESPN Fantasy endpoints and transaction payloads are unofficial/undocumented; real-league payload validation remains important.
- Transaction players receive the rich metadata/stats returned by the focused ESPN player endpoint. News is still fetched only for the configured current roster, so a free-agent transaction player may not have news in the shared popup.
- Existing Player and Game Active entities are created from the roster present during integration setup/reload; dynamic roster entity lifecycle deserves a future audit but is not part of the v0.1.32 release gate.
- The development branch was created before the README disclosure commit on main. The branch README was rebuilt from the current main README so the disclosure text is preserved, but Git history is currently one commit behind main until the release branch is reconciled/merged.

## Next-session workflow

1. Start from main at the v0.1.32 published checkpoint above.
2. Collect real-world v0.1.32 feedback before choosing the next version scope.
3. Preserve `docs/ENTITIES.md` as sensors or attributes are added.
4. Keep ESPN payload handling defensive because the fantasy endpoints are unofficial.
5. Use the established release flow: concentrated implementation → regression checks → Frontend/Hassfest/HACS → PR/merge → publish → update this handoff again.
