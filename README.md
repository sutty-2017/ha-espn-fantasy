> **v0.1.48:** Reworks Home Assistant diagnostics into a bounded Fantasy-focused payload instead of exporting the entire multi-megabyte coordinator. Keeps league settings, team structure, matchup/schedule summaries, recent transactions, normalized standings/scoreboard/schedule/playoffs/waivers/activity, and the normalized current matchup while omitting duplicated raw roster/news/history blobs.\n\n# ESPN Fantasy Football for Home Assistant

> [!CAUTION]
> **Personal-use / early-development project.** This integration is currently built and tested primarily for the maintainer's own Home Assistant and ESPN Fantasy setup. Other leagues, scoring systems, roster formats, ESPN response changes, and Home Assistant environments may behave differently. If you install or use it, you do so **at your own risk**. Keep backups and review changes before relying on it for dashboards or automations.

> [!NOTE]
> **AI-assisted development:** This project is maintained by the repository owner with substantial coding, debugging, refactoring, documentation, and test assistance from **ChatGPT by OpenAI**. The maintainer directs the project, tests it against the real Home Assistant/ESPN environment, and decides what is merged and released. AI-generated or AI-assisted code should be reviewed and tested like any other contribution.


Bring your ESPN Fantasy Football league into Home Assistant with native entities, automation-friendly data, and a coordinated dashboard card suite.

The integration connects directly to ESPN Fantasy data and exposes league standings, your team and roster, live matchup scoring, player projections and statistics, current-season weekly history, projection-based lineup alerts, injuries, game status, fantasy outlooks, and player news.

> **Unofficial integration:** This project is not affiliated with or endorsed by ESPN.

## Highlights

- UI-based Home Assistant configuration
- Public and private ESPN Fantasy Football leagues
- League standings and current-week scoreboard
- Team record, scoring totals, roster and lineup data
- Current matchup with scores, projections, win probability, and both starting rosters
- Individual roster-player sensors with fantasy points, projections, game statistics, injury status, NFL matchup and game state
- Offensive, kicker, D/ST, and IDP player support
- Current-season weekly player history with season totals/averages
- Projection-based starter/bench lineup alerts that respect ESPN slot eligibility
- Player fantasy outlooks and ESPN fantasy news
- Player **Game Active** binary sensors for live NFL games
- Coordinated 5-minute polling with focused 60-second current-matchup updates while either side has players actively playing
- Data exposed as Home Assistant entity attributes for dashboards and automations
- Four primary Lovelace cards with shared player popups and appearance controls; legacy card types remain registered for compatibility
- Home Assistant theme inheritance plus **Glass**, **Solid**, and **Transparent** appearance presets
- HACS-compatible repository structure

## Installation with HACS

1. Install [HACS](https://www.hacs.xyz/) if needed.
2. Open **HACS → Integrations**.
3. Open the three-dot menu and select **Custom repositories**.
4. Add `https://github.com/sutty-2017/ha-espn-fantasy` as an **Integration** repository.
5. Install **ESPN Fantasy Football** and restart Home Assistant.
6. Go to **Settings → Devices & services → Add Integration** and search for **ESPN Fantasy Football**.

The integration serves and registers its dashboard cards automatically; no separate frontend repository or manual Lovelace resource is required.

## Configuration

The setup flow asks for:

- **League ID** — the numeric ID of your ESPN league.
- **Team ID** — your numeric fantasy team ID within that league.
- **Season** — for example `2026`.
- **ESPN S2 cookie** and **SWID cookie** — needed for many private leagues.

For a public league, leave the cookie fields blank.

### Private leagues

ESPN does not provide a stable public authentication flow for this API. Private leagues may require the `espn_s2` and `SWID` browser cookies from an authenticated ESPN session.

Treat these cookies like credentials. Do not commit them to GitHub, include them in issue reports, or paste them into public logs.

## Home Assistant data

The integration creates a device for the configured fantasy league/team and exposes sensors for league information, **League Activity**, **Lineup Recommendations**, **Injured Players**, your team, record, points for/against, current week, roster, matchup, and each rostered player. Each player also receives a **Game Active** binary sensor.

Player entities expose fantasy-relevant attributes including position, NFL team, lineup slot, injury status, ownership, actual/projected points, game status, opponent, detailed game statistics, weekly history/season summary, lineup recommendations, weekly/season outlooks, and cached player news. This makes the same normalized data used by the cards available for Home Assistant templates and automations.

For a complete map of every provided sensor, binary sensor, and the important attributes tucked inside them, see **[Home Assistant entities and attributes](docs/ENTITIES.md)**.

## Dashboard cards

### ESPN Fantasy Player
A focused player card with headshot, injury indicator, game status, fantasy score/projection, configurable detailed statistics, fantasy outlook, and latest player news.

### ESPN Fantasy League
The main dashboard card is section-based. New cards enable **Roster**, **Standings**, **Scoreboard**, **Matchup**, **News**, **Activity**, **Waivers**, **Schedule**, and **Playoff Bracket** by default. Use the editor checkboxes to keep any combination down to a single section, and reorder only the sections that are enabled. Section-specific settings stay grouped with their section and are hidden when that section is disabled.

Roster and Matchup each include **Starters / Bench & IR** views. Projection-based lineup alternatives can be toggled independently for each section and appear as an orange **−** badge on the lower-projected starter and a green **+** badge on the qualifying bench player. Standings rows can open a roster-style team popup, while Scoreboard games can open a matchup-style popup; both drill down through team rosters and player details inside one modal with Back navigation. Schedule provides a League view with compact previous/next week navigation and a My Team view that lists the full season using the same matchup styling. The Playoff Bracket exposes all postseason tiers ESPN supplies, including championship, consolation, and ladder paths, with horizontal scrolling and an icon-only wide-view control; ESPN schedule playoff data is preferred when present, with a clearly labeled current-standings championship projection as a fallback before ESPN postseason data is available. The League card can optionally use a card-wide maximum height (0 keeps automatic sizing); when content exceeds that height, the card scrolls internally. News and Activity use that same card-wide sizing behavior, and selected card views are remembered.

### ESPN Fantasy Ticker
The ticker uses the same section model for **Players**, **Scoreboard**, and **Activity**, with all three enabled on new cards. Sections can be independently enabled, disabled, and reordered, while settings for disabled sections stay out of the editor. The pinned identity panel follows the active section. Choose **Step** or continuous **Smooth** scrolling, size the ticker for compact through wall-panel layouts, and customize identity/header presentation and appearance.

Player tiles open the shared player-details popup. Activity transactions open the shared transaction popup; ticker Activity uses a compact team block with date/time under the team name and vertically stacked players to avoid unnecessary width.

### ESPN Fantasy News
A newest-first feed of fantasy news for players on your roster. Each story includes the player's name and portrait, with a configurable story count, and selecting a story opens that player's shared details popup.

Existing Player Ticker, Team, Matchup, and League Ticker custom-element types remain registered so existing dashboards are not deliberately broken while the consolidated cards become the preferred configuration.

### Appearance

Every bundled card supports a shared appearance system:

- **Home Assistant theme** — inherits the active dashboard theme.
- **Glass** — translucent card surface with configurable blur.
- **Solid** — standard solid Home Assistant card surface.
- **Transparent** — frameless/transparent presentation.

Cards also expose accent-color and border controls. The normal Home Assistant theme remains the default so the suite fits an existing dashboard without requiring custom styling.

## Player details and news

Player tiles across the suite share a common detailed view. Where player details are available, expanded content includes game statistics, current-season historical stats, ESPN fantasy outlook information, and the latest cached news. Stats, Historical stats, Fantasy Outlook, and Latest news are independently collapsible to keep larger popups manageable. Fantasy Outlook shows the complete available outlook when expanded rather than using a separate preview/read-more flow.

News is fetched by the integration rather than by individual cards. This keeps ESPN requests coordinated, allows the information to be exposed on player entities for automations, and lets multiple cards reuse the same data.

## API notes

This integration uses ESPN's currently observed Fantasy Football endpoints. ESPN does not document these as a stable public API, so fields and endpoint behavior can change without notice.

The integration normalizes ESPN data before exposing it to Home Assistant and the bundled cards so frontend components can share a consistent data model.

## Troubleshooting

### Unable to retrieve the ESPN league

Check the League ID, selected season, Home Assistant's internet connectivity, and that the league exists for that season.

### Private-league authentication failure

Verify that both `espn_s2` and `SWID` are current and were copied exactly from an authenticated ESPN browser session.

### Dashboard card changes do not appear after updating

Restart Home Assistant after updating the integration. If a browser or wall-panel session still has an older frontend resource cached, reload that client after Home Assistant is back online.

## Development status

The current release candidate is **v0.1.49**, focused on richer live-game/matchup context and resilience through transient ESPN API failures. Pick’em remains intentionally removed.


## Help test another league format

ESPN Fantasy leagues can differ substantially in roster slots, scoring, waivers,
playoffs, divisions, keepers, and IDP usage. Compatibility reports from real
leagues are especially useful for formats not represented by the maintainer's
league.

When reporting a league-format issue, attach the Home Assistant diagnostics for
the ESPN Fantasy integration and describe the league format (for example:
Superflex, IDP, FAB, keeper, divisions, or six-team playoffs). Diagnostics
redact the ESPN authentication cookies and omit ESPN member profiles.

The integration records a compact compatibility summary containing the observed
league capabilities and unknown ESPN lineup/position IDs. Small sanitized
response shapes can then be added under `tests/fixtures/` as permanent
regression coverage. Never post `espn_s2` or `SWID` cookie values.

## Release history

> **v0.1.41:** Polishes the League card by restoring readable Waiver Order team names, keeping editor text fields focused while typing, and optionally combining Standings + Scoreboard into one reorderable Overview section.\n\n> **v0.1.40:** Fixes a v0.1.39 Playoff Bracket regression that could hide the Championship Bracket while aligning Winners Consolation to the final postseason round, adds Waiver Order team-to-roster drill-down parity, makes every Schedule matchup open the matchup drill-down, and normalizes popup/UI headings to title case.\n\n> **v0.1.39:** Adds a League-card-wide maximum height with internal scrolling, widens Scoreboard matchup drill-downs, and aligns the single Winners Consolation matchup with the second postseason round.\n\n> **v0.1.38:** Fixes a setup regression where ESPN can return HTTP 200 without a `schedule` key for optional whole-season schedule enrichment; the integration now degrades gracefully instead of failing setup.\n\n> **v0.1.37:** Adds compatibility/resilience diagnostics and fixture testing, complete postseason presentation with Winners Consolation, Roster/Matchup lineup-advice badges, and interactive Scoreboard/Standings drill-down popups with single-modal Back navigation.

> **v0.1.36:** Fixes traditional-waiver budget display, adds the enabled Consolation Ladder to pre-playoff standings projections, fixes All-in-One navigation after viewing Playoffs, and improves team-logo watermark visibility.

> **v0.1.35:** Adds richer postseason schedule retrieval for consolation/ladder brackets, Waiver Order, player biographies, team-logo watermarks, and clearer Started/Benched/trade Activity semantics.\n\n> **v0.1.34:** Refines Schedule with League/My Team views and compact week arrows, exposes all ESPN postseason tiers with a cleaner expandable bracket, and adds focused 60-second live matchup polling while games are active.

> **v0.1.33:** Adds section-based League and Ticker editors, full-season Schedule and playoff-bracket views, fixes portrait-anchored red injury badges, streamlines Fantasy Outlook, and polishes Activity ticker layout.

> **v0.1.32:** Restores complete weekly history/injury normalization, expands League Activity with rich player/team identity and transaction popups, and adds automation-friendly Activity, Lineup Recommendations, and Injured Players sensors.


> **v0.1.31:** Adds normalized league transaction activity to Home Assistant, optional Activity in the All-in-One card and ticker, reliable per-week current-season history fetching, and shared roster injury-status enrichment.
