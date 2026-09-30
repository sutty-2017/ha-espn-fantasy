> **v0.1.32:** Restores complete weekly history/injury normalization, expands League Activity with rich player/team identity and transaction popups, and adds automation-friendly Activity, Lineup Recommendations, and Injured Players sensors.\n\n
> **v0.1.31:** Adds normalized league transaction activity to Home Assistant, optional Activity in the All-in-One card and ticker, reliable per-week current-season history fetching, and shared roster injury-status enrichment.

# ESPN Fantasy Football for Home Assistant

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
- Coordinated polling with separately throttled player-news updates
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

Player entities expose fantasy-relevant attributes including position, NFL team, lineup slot, injury status, ownership, actual/projected points, game status, opponent, detailed game statistics, weekly history/season summary, lineup recommendations, weekly/season outlooks, and cached player news. This makes the same normalized data used by the cards available for Home Assistant templates and automations.\n\nFor a complete map of every provided sensor, binary sensor, and the important attributes tucked inside them, see **[Home Assistant entities and attributes](docs/ENTITIES.md)**.

## Dashboard cards

### ESPN Fantasy Player
A focused player card with headshot, injury indicator, game status, fantasy score/projection, configurable detailed statistics, fantasy outlook, and latest player news.

### ESPN Fantasy League
The main dashboard card. It can run as a standalone **Roster**, **Standings**, **Scoreboard**, or **Matchup** view, or as an **All-in-one** card that switches between those views and optional **News** and **Activity**. Roster and Matchup each include their own **Starters / Bench & IR** switch. The Roster view flags a starter with a red down arrow and an eligible higher-projected bench option with a green up arrow; the minimum projection difference is configurable. All-in-one navigation sections can be reordered with compact arrow controls. News has a configurable story count and scrollable height, news stories open the shared player-details popup, navigation labels and the card title are customizable, and selected views are remembered. The header can optionally show the bundled ESPN Fantasy mark.

### ESPN Fantasy Ticker
One ticker for **Players**, **Scoreboard**, or **Players + Scoreboard**. The identity panel stays pinned on the left while content scrolls and switches between your team and league identity in combined mode. Choose **Step** or continuous **Smooth** scrolling, flip Players/Scoreboard order, and customize logo + name, logo only, name only, or hidden identity modes. When ESPN does not provide a league logo, the ticker uses bundled ESPN Fantasy branding. The pinned identity background is opaque with a soft fade edge and can be color-customized in the card editor. Player tiles in the ticker open the same shared player-details popup used elsewhere. Activity can also be included in the ticker; transaction tiles are wider for readability and open the shared transaction-details popup.

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

Player tiles across the suite share a common detailed view. Where player details are available, expanded content includes game statistics, current-season historical stats, ESPN fantasy outlook information, and the latest cached news. Stats, Historical stats, and Latest news are independently collapsible to keep larger popups manageable.

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

The current development line is **v0.1.31**, adding current-season player history and season summaries, automation-friendly lineup advice, collapsible player-popup sections, and matched player/scoreboard ticker heights.
