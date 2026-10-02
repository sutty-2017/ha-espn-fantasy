# ESPN Pigskin Pick'em research

Status: experimental research on `feature/pickem`. This branch is intentionally separate from stable releases.

## Architecture finding

Pigskin Pick'em is not part of the Fantasy Football `ffl` league API. ESPN exposes Pick'em through the Gambit challenge API:

- Base: `https://gambit-api.fantasy.espn.com/apis/v1`
- Challenge: `/challenges/nfl-pigskin-pickem-{season}`
- Group: `/challenges/{challenge}/groups/{group_id}`
- Entry: `/challenges/{challenge}/entries/{entry_id}`
- Leaderboard: `/challenges/{challenge}/leaderboard`
- Propositions: `/propositions?challengeId={challenge_id}`

Observed/documented views include `allon`, `chui_default`, `chui_default_group`,
`chui_default_groupParticipationHistory`, `chui_default_metadata`,
`chui_pagetype_group_picks`, and `pagetype_leaderboard`.

This supports treating Pick'em as a separate competition/source type rather than attaching it to an ESPN Fantasy league.

## Authentication

Community observations indicate some Gambit resources that were formerly public began requiring ESPN authentication in 2024. The existing integration already supports the `espn_s2` and `SWID` cookies used by ESPN Fantasy, so research should determine whether those same credentials are sufficient for the current Pick'em endpoints.

Never log or fixture real authentication cookies.

## Important privacy/behavior finding

Public/group entry data can intentionally hide future picks until the relevant game begins. A season entry's `picks` collection may therefore contain only revealed picks rather than an authoritative list of the user's submitted future picks.

Consequences:

- Do not infer “unpicked” merely because a future pick is absent from public/group data.
- A reliable “picks remaining” sensor requires an authenticated self-entry response (or another ESPN response) that explicitly exposes submission state before lock.
- Group members' unrevealed picks should remain unrevealed.

## Candidate read-only HA model

Initial entities/attributes worth validating against live payloads:

- Pick'em competition/group name and current scoring period.
- User entry name/rank/score.
- Current-week games/propositions.
- The authenticated user's picks where ESPN exposes them.
- Group standings/leaderboard.
- Weekly/season results.
- Lock/deadline metadata if supplied by ESPN.
- Picks remaining only if it can be derived authoritatively.

## Write support

Do not implement pick submission yet. The read API shape is documented enough to prototype safely, but no sufficiently verified current write contract has been established in this research. Any future write support should be separately investigated, opt-in, confirmation-gated, and verified by a subsequent read.

## Next research steps

1. Identify the current-season challenge metadata and challenge ID dynamically rather than hard-coding historical IDs.
2. Test current challenge/group/entry/proposition responses with a real Pick'em group.
3. Determine whether existing `espn_s2` + `SWID` authentication exposes the signed-in user's unrevealed picks/submission state.
4. Capture sanitized fixtures for challenge, group, entry, leaderboard, and propositions.
5. Build a standalone Gambit/Pick'em client and normalizer only after live payloads are understood.
6. Keep Fantasy `ESPNClient` behavior unchanged while this work is experimental.
