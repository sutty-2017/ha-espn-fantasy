# v0.1.54 — Compact league data and safe frontend startup

- Fix the ESPN frontend startup listener so HA runs it on the event loop, preventing the observed `hass.async_create_task` thread-safety warning. Guard registration against duplicate tasks and stale cleanup callbacks.
- Add an optional **Use compact league data (bundled cards)** integration setting. It stores distinct player details once and references them from schedules, scoreboards, and team rosters.
- Keep the existing export format as the default for custom templates and third-party cards. Compact mode changes nested league attribute paths; the bundled cards support both formats.
- Preserve matchup scores, projections, probabilities, starter progress, advice, biographies, history, and all popup navigation in the bundled cards.
- Keep video highlights removed and text news available.

## Enable the payload reduction

After updating through HACS and restarting HA:

1. Refresh/reload the dashboard so the v0.1.54 cards are loaded.
2. Open **Settings → Devices & services → ESPN Fantasy Football → Configure** (gear/options).
3. Enable **Use compact league data (bundled cards)** and save. The integration reloads automatically.
4. Refresh the dashboard again if needed.

Leave this setting off if external templates/cards read full players directly from `schedule[*].home_team.roster`, `scoreboard`, or `team_rosters`. Turning it off restores the original league attribute format. Entity IDs and card YAML do not change.

Validation: 31 Python regression tests, actual frontend markup comparisons for all fixture schedule/scoreboard matchups and team/player popups, nested player-click navigation, and local workflow checks pass. The synthetic league JSON shrank from 13,442,025 bytes to 1,058,305 bytes (92.1%) with a lossless round trip. This is serialized payload size, not a measurement of HA process RAM. Compact exports remain larger than Recorder's 16 KiB attribute limit; this does not promise to eliminate every size warning or memory crash.

No live HA configuration or installed files were modified during preparation.
