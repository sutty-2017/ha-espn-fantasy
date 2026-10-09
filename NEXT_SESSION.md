# ESPN Fantasy maintainer handoff

## Current work

- Repository: `sutty-2017/ha-espn-fantasy`.
- Published baseline: v0.1.53, PR #36, main commit `534012794a6cebb69cffbf766264ff611edb9124`.
- Follow-up candidate: **v0.1.54**, branch `optimize-fantasy-payload-v054`.
- Maintainer publishes releases; do not modify live HA without explicit authorization.

## Live inspection after v0.1.53

HACS showed v0.1.53 installed and ESPN loaded. HA restarted at 8:17 PM Pacific on October 8. The newest OOM kill in returned host logs was 7:50 PM, before that restart. There was no dependable before/after Core RAM measurement available. League attributes serialized to about 19.2 million JSON characters, 16.4 million in the schedule. Recorder size warnings remained. ESPN and daily-puzzle both had startup task thread-safety warnings; daily-puzzle is a separate project.

## v0.1.54 fixes

An async frontend startup listener prevents ESPN's executor-thread task scheduling warning, with guards for duplicate registration and stale task cleanup. Optional compact league transport shares distinct player details through references, while bundled cards transparently resolve both formats. Integration Configure exposes the option and reloads after changes. The default remains legacy mode to protect external templates/cards. Video highlights stay removed and text news remains.

All 31 Python regressions and frontend runtime comparisons pass locally. Synthetic league JSON decreases 92.1% (13.4 MB to 1.1 MB); fully expanded data and rendered popups remain equal. See `docs/OPTIMIZATION.md` for tests/limitations and `docs/RELEASE_NOTES_0.1.54.md` for publishing and activation instructions.

## Activation and constraints

After publication/install, refresh the dashboard to load v0.1.54 cards, then enable **Use compact league data (bundled cards)** in the integration's Configure options. No live option was enabled during development. Legacy mode preserves old league data paths; compact mode changes nested schedule/scoreboard/team roster paths for external consumers. Turning it off restores legacy exports. No card YAML or entity-ID migration is needed for bundled cards.

Do not claim this fixes the HA Green memory crashes or eliminates all Recorder warnings. Payload-size savings are measured; installed HA process-memory savings are not. Check the latest branch/main/PR state and CI before further work. Release publication remains with the maintainer.
