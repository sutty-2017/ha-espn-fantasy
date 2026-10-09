# v0.1.53 — Fantasy model optimization

Release candidate for maintainer approval. Do not publish until approved.

- Reduce repeated player normalization across schedules, scoreboards, team rosters, and matchups by reusing stats/history within each refresh.
- Preserve existing Fantasy sensor attributes, entity IDs, card settings, lineup advice, historical stats, league activity, matchup projections/probabilities, and dashboard data.
- Remove NFL video highlights completely: no video requests, game-video caches, player matching, playlists, video playback, or Highlights editor options. Fantasy text news remains available.
- Keep legacy `highlights` sensor attributes as empty lists and ignore old Highlights card options so existing dashboard configurations continue to load.
- Clear stale status after a successful live refresh.
- Improve diagnostics sampling and payload bounds while retaining useful summaries and credential redaction.
- Deduplicate enrichment IDs and tolerate malformed transaction rows during enrichment collection.
- Run the full regression suite in CI and correct frontend workflow checks.

Validation: 23 Python regression tests, frontend runtime checks for news/popups with legacy settings, integration compilation, frontend syntax, version alignment, and all local workflow shell checks pass. The synthetic benchmark's complete serialized model matches the v0.1.52 baseline, with approximately 68% fewer retained model allocations and 62% lower build time. See `OPTIMIZATION.md` for fixture, measurements, reproduction, and testing limits.

No card YAML migration is required. Pick'em remains removed. Large serialized attributes can remain; this release does not establish the cause of, or claim to resolve, Home Assistant memory crashes.

After publication and a normal HACS update, restart Home Assistant and refresh the dashboard frontend as usual. Observe memory and dashboard behavior after installation; no automatic installation or configuration change is part of this PR.
