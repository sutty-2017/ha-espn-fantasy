# Maintainer / agent handoff

## Release state

- Published stable release: **v0.1.41**
- Exact stable release commit: **90c836c98e6da77e065366bf095100218abaffa8**
- Release PR: **#19** (`dev/v0.1.41-polish`, squash-merged)
- Pre-merge release gates passed: **Frontend validation, Hassfest, HACS validation**.
- Maintainer confirmed v0.1.41 was posted.
- v0.1.41 remains the published/tagged stable checkpoint. Do not move its tag to later housekeeping/research commits.
- Main also contains the dormant experimental Pick'em foundation from **PR #20**, squash merge **d55f5def8e07830717cde65dcaaa5dadc9ce10bb**. This does not enable Pick'em polling, entities, config flow, or cards in normal runtime.

## v0.1.41 scope

- Fixed Waiver Order team-name layout regression while preserving team → roster popup behavior.
- Fixed editor free-text focus loss by avoiding full rerenders on every `ha-form` value change in League and Ticker editors.
- Added optional combined Standings + Scoreboard **Overview** section with customizable title and internal ordering.
- Manifest/frontend versions are 0.1.41.

## Experimental Pick'em foundation

PR #20 added isolated read-only research infrastructure:
- `custom_components/espn_fantasy/pickem_api.py`: standalone ESPN Gambit/Pick'em read client.
- `custom_components/espn_fantasy/pickem.py`: diagnostics-safe structural payload summarizer.
- Unit tests for client routing/auth cookie handling and sanitizer behavior.
- `docs/PICKEM_RESEARCH.md`: research notes.
- Personal entry IDs and temporary diagnostics probes were removed before merge.
- Existing Fantasy coordinator, sensors, cards, config flow, and polling remain unchanged.

Pick'em uses ESPN's separate Gambit challenge API rather than the Fantasy `ffl` league model. Public/group payloads may hide future picks, so absence of a pick must not be interpreted as unpicked. Reliable Picks Remaining requires authoritative authenticated self-entry/submission state. Write support remains out of scope until a current write contract is verified; initial implementation should remain read-only.

## Long-term account / competition architecture

Desired install experience:
1. Install the integration once.
2. Supply/establish ESPN account authorization once.
3. Discover competitions accessible to that account.
4. Create one Home Assistant device per Fantasy league and one per Pick'em competition/group.
5. Put competition-specific entities beneath the corresponding device.
6. Rediscover/reconcile when the account joins/leaves competitions without requiring duplicate integration installs.

Model this as **ESPN account/config entry → competitions → devices → entities**.

Fantasy competition devices can own League/Roster/Matchup/Activity/Waivers/Schedule/Playoff data. Pick'em devices can own Entry/Picks/Weekly Results/Group Standings/lock metadata. Do not force Pick'em into Fantasy league semantics.

Research indicates ESPN's authenticated fan-profile endpoint may expose Fantasy league IDs/names/team information from an SWID, making account-level Fantasy discovery plausible. This is unofficial and must be verified against a live signed-in response before production use. Pick'em account-level entry/group discovery still needs equivalent live validation.

Credentials are sensitive session credentials. Never log, fixture, expose in diagnostics, or commit `espn_s2`/SWID. Prefer read-only access and fail closed on schema drift.

## Multi-league / multi-competition frontend direction

Current convenience discovery helpers can fall back to the first matching ESPN entity and are unsafe once multiple leagues exist. Before multi-league support ships:
- Give every entity explicit competition/config-entry identity.
- Resolve companion entities only inside the same competition.
- Preserve today's simple behavior for one-league installations.
- All-in-One: league/competition name can become an HA-style selector among enabled competitions; remember the selected competition locally.
- Ticker: allow intentionally mixed sections from multiple Fantasy leagues and Pick'em sources, with configurable ordering.
- Carry competition identity through every team/player/matchup/popup action so drill-downs cannot cross leagues.
- Capture sanitized two-league fixtures and add CI coverage when a second test league is available.

## Current phase

Keep **v0.1.41** as the stable user-facing release while experimental discovery/Pick'em work matures on main/feature branches. Do not publish dormant research as a new release merely because it is merged.

For the rest of the 2026 season, prioritize stabilization, defensive parsing, obvious holes, and compatibility. Larger fantasy-intelligence/Game Day concepts remain tabled until next year unless explicitly reprioritized.

## Known caveats

- ESPN Fantasy, fan-profile, Gambit/Pick'em, postseason, transaction, and athlete-profile interfaces used here are unofficial/undocumented and may change.
- Account-level Fantasy discovery appears feasible but still needs live validation in this integration.
- Pick'em entry/group discovery and authenticated unrevealed-pick visibility still need live validation.
- Real-world Winners Consolation semantics and trade payloads remain useful validation targets.
- `team_rosters` increases HA state attributes; monitor recorder/state size.
- Existing Player/Game Active entity lifecycle remains a future audit item.

## Workflow

Use the established release flow:
**stable release → real-world HA testing → collect feedback → design/discuss → concentrated implementation/validation → release candidate → CI → PR/merge → maintainer publishes → verify release checkpoint → post-release handoff update**.
