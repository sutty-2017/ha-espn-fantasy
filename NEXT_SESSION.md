# Maintainer / agent handoff

## Release state

- Published stable release: **v0.1.33**
- Published tag: **v0.1.33**
- Exact release/main commit: **26f7f1da3590a8a4185ee833a064bb4a7a2b6bf9**
- Release PR: **#9**
- v0.1.34 release candidate branch: **dev/v0.1.34-schedule-brackets-live**
- v0.1.34 is **not published yet**. Publish only after its PR/CI is green and the maintainer approves the release.

## v0.1.34 release-candidate scope

### Schedule
- Schedule has two remembered views: **League** and **My Team**.
- League view uses compact previous/next arrows with the selected week centered between them.
- My Team lists the configured team's complete season schedule vertically.
- Both views reuse the same league matchup/game renderer so logos, scores, projections, status and spacing remain consistent.
- The current week is highlighted in My Team view.

### Playoff bracket
- Backend no longer filters postseason data to only `WINNERS_BRACKET`.
- Every non-empty ESPN `playoffTierType` is normalized into `playoff_bracket.sections`, including championship, consolation and ladder structures.
- Known tiers receive friendly labels; unknown ESPN tiers are retained defensively rather than discarded.
- Legacy `playoff_bracket.rounds` remains populated from the primary/winners section for compatibility.
- The card renders all postseason sections in sequence.
- Round-jump buttons were removed.
- The only bracket action is an icon-only Home Assistant/MDI expand control.
- Each bracket remains horizontally scrollable; expanded view shows the complete postseason display.

### Adaptive live matchup polling
- Normal full integration refresh remains **5 minutes**.
- When any player on either side of the configured current matchup is `in_progress`, coordinator cadence becomes **60 seconds**.
- Intermediate live refreshes use only focused ESPN `mLiveScoring`, `mMatchupScore`, and `mBoxscore` views.
- Full league/settings/standings/schedule/transactions/news/history work is not repeated every minute.
- Both the configured team and opponent rosters are included when deciding whether live polling is active.
- Cached roster news is preserved across focused live refreshes.
- A full refresh still occurs at least every five minutes while games are live.

## Validation expectations

Before publication:
1. Frontend validation must pass, including Schedule/Bracket regression checks.
2. Hassfest must pass.
3. HACS validation must pass.
4. Confirm manifest/frontend versions are both **0.1.34**.
5. Merge the release PR to main.
6. Publish/tag **v0.1.34** from the exact merged main commit.
7. Verify post-merge/tag workflow checks and then update this file again with the exact published commit/tag.

## Real Home Assistant test focus after publication

- League Schedule arrows and disabled first/last-week behavior.
- League/My Team Schedule switch persistence.
- Full My Team schedule and current-week highlight.
- Consistent matchup styling between both Schedule modes.
- Championship, consolation and ladder postseason sections using the real league payload.
- Horizontal bracket scrolling and icon-only expanded view on desktop/wall tablet.
- During a live NFL game, verify matchup/player scores update about once per minute for both teams while ordinary full data remains on the five-minute cycle.

## Known caveats

- ESPN Fantasy endpoints and postseason tier names are unofficial/undocumented. The normalizer intentionally preserves unknown non-empty playoff tier values.
- The 60-second path depends on ESPN returning a usable current matchup from the focused live-scoring views. Real-game testing is still required.
- Existing Player and Game Active entity lifecycle is based on roster entities created at setup/reload; dynamic roster entity lifecycle remains a future audit item.

## Workflow

Use the established release flow:
**release candidate → CI → PR/merge → maintainer publishes → verify exact tag/main + post-release checks → real-world HA testing → collect feedback → next concentrated cycle**.
