# Home Assistant entities and attributes

This page is a map of the information exposed by ESPN Fantasy Football. It is intended for new users building dashboards, templates, and automations.

> Entity IDs shown below are examples. Home Assistant generates the final entity ID when the integration is added, and users can rename entities. The entity **name** and the listed attributes are the reliable way to identify the data.

## Where to look

Open **Settings → Devices & services → ESPN Fantasy Football → Devices**, open the ESPN Fantasy device, then select an entity. Home Assistant's **Developer Tools → States** view is also useful for inspecting every attribute.

The integration deliberately uses a mix of focused sensors and richer attributes. Frequently useful automation states have dedicated entities, while larger structures such as standings, rosters, historical weeks, and transaction details remain attributes to avoid creating hundreds of entities.

## League

**Entity name:** League  
**Typical entity:** `sensor.espn_fantasy_*_league`  
**State:** ESPN league name.

Attributes:

- `league_id` — ESPN league ID.
- `season` — configured season.
- `team_count` — number of fantasy teams.
- `current_week` — current matchup period.
- `scoring_type` — ESPN scoring type.
- `standings` — normalized full league standings, including team identity, record, rank/seed, points and logo data.
- `scoreboard` — normalized current league matchups with team IDs/names/logos, scores and projections.
- `schedule` — normalized full-season fantasy matchups with period, team identity, scores/projections, winner/status, playoff tier, and seeds where available.
- `schedule_periods` — sorted matchup periods present in the normalized full-season schedule.
- `playoff_bracket` (includes `sections` for each ESPN postseason tier, plus legacy `rounds` for the primary bracket) — normalized winners-bracket model used by the card. Includes availability/projected flags, data source, playoff-team count, rounds, round labels, matchup periods, and normalized matchups.
- `activity` — normalized recent league transactions. This is the complete Activity feed used by the cards.
- `activity_count` — number of normalized Activity events currently available.
- `matchup_count` — number of current scoreboard matchups.
- `matchup_period` — current fantasy matchup period.

## League Activity

**Entity name:** League Activity  
**State:** human-readable description of the latest league transaction.

This is the easiest entity to use as an automation trigger for adds, drops, waivers, and trades. The full Activity history remains available on the League sensor.

Attributes:

- `activity_count` — available event count.
- `transaction_id` — ESPN transaction identifier.
- `transaction_type` — normalized transaction type.
- `status` — ESPN transaction status.
- `timestamp` — transaction timestamp.
- `team_id`, `team_name`, `team_logo` — primary fantasy-team identity when applicable.
- `is_trade` — true when the event is normalized as a trade.
- `bid_amount` — FAAB bid when ESPN supplies one; the UI hides zero/empty bids.
- `items` — players/items involved, including player ID/name, photo, position, NFL team, injury status, source/destination team, and normalized player details.
- `sides` — team-oriented transaction sides. Trades expose each fantasy team with its logo plus players sent/received.
- `recent_activity` — up to the 10 newest normalized events.

## Lineup Recommendations

**Entity name:** Lineup Recommendations  
**State:** number of starters for which an eligible bench player has a higher ESPN projection.

Attributes:

- `recommendations` — list containing starter ID/name/position/projection, replacement ID/name, and projected improvement.
- `has_recommendations` — convenient boolean.
- `current_week` — current scoring period.

The same recommendation is also stored on the affected Player sensors through the `lineup_alert*` attributes.

## Injured Players

**Entity name:** Injured Players  
**State:** number of roster players with a meaningful ESPN injury designation.

Attributes:

- `players` — affected player ID/name, position, NFL team, roster slot, injury status, and ESPN injured flag.
- `has_injuries` — convenient boolean.
- `current_week` — current scoring period.

## My Team

**Entity name:** My Team  
**State:** configured fantasy-team name.

Attributes:

- `team_id`, `abbrev`, `location`, `nickname`, `logo`
- `wins`, `losses`, `ties`
- `points_for`, `points_against`
- `standing`, `division_id`
- `current_score`, `projected_score`, `live_projected_score`
- `win_probability`
- `starter_count`
- `starters_playing`, `starters_remaining`, `starters_completed`, `starters_on_bye`

## Record

**Entity name:** Record  
**State:** `W-L-T`.

Attributes: `wins`, `losses`, `ties`.

## Points For / Points Against

**Entity names:** Points For and Points Against  
**State:** season fantasy points, in points.

These are intentionally simple sensors for dashboards and automations.

## Current Week

**Entity name:** Current Week  
**State:** current ESPN scoring period/week.

## Roster

**Entity name:** Roster  
**State:** number of players on the normalized roster.

Attributes:

- `players` — complete normalized roster. This is one of the richest places to inspect player data used by the cards.
- `starters` — normalized current starters.
- `score`, `projected_score`, `live_projected_score`, `win_probability`
- `team_name`, `team_abbrev`, `team_logo`
- `starter_count`
- `starters_playing`, `starters_remaining`, `starters_completed`, `starters_on_bye`, `starters_unknown`

## Matchup

**Entity name:** Matchup  
**State:** your current matchup score, in points.

Attributes:

- Periods: `current_week`, `current_scoring_period`, `current_matchup_period`
- Your team: `team_id`, `team_name`, `team_score`, `team_projected_score`, `team_live_projected_score`, `team_win_probability`, `team_logo`, starter playing/remaining/completed counts.
- Opponent: corresponding `opponent_*` team identity, score, projections, win probability, logo, and starter counts.
- `point_differential`
- `result` — WIN, LOSS, TIE, or UNKNOWN based on current scores.
- Next matchup: `next_matchup_period`, `next_opponent_team_id`, `next_opponent_team_name`.
- `my_roster`, `opponent_roster` — normalized starters.
- `my_players`, `opponent_players` — complete normalized player lists.

## Player sensors

**Entity name:** the ESPN player name  
**One sensor per configured-team roster player**  
**State:** current/live fantasy points, in points.

Important attributes:

- Identity/roster: `player_id`, `player_name`, `position`, `roster_slot`, `eligible_slots`, `nfl_team`, `pro_team_id`, `headshot`.
- NFL matchup: `opponent`, `opponent_abbrev`, `opponent_name`, `opponent_pro_team_id`, `home_away`, `game_id`, `game_status`, `game_start`, `start_time_tbd`.
- Health/status: `player_status`, `injury_status`, `injured`, `active`, `starter`, `lineup_locked`.
- Fantasy points: `live_points`, `actual_points`, `projected_points`, `points_vs_projection`, `season_points`, `season_average`, `projected_season_points`, `projected_season_average`.
- Ownership/rank: `percent_owned`, `percent_started`, `position_rank`, `overall_rank`, `total_rating`.
- Acquisition: `acquisition_type`, `acquisition_date`.
- Periods: `current_week`, `current_scoring_period`, `current_matchup_period`.
- Current game statistics: `stats`, `stat_labels`, `default_stats`, plus decoded stat attributes such as passing/rushing/receiving/defensive statistics when ESPN supplies them.
- History: `weekly_history` and `season_summary`.
- Lineup advice: `lineup_alert`, `lineup_alert_player_id`, `lineup_alert_player_name`, `lineup_alert_difference`.
- News/outlook: `last_news_date`, `news`, `latest_news`, `weekly_outlook`, `season_outlook`.

### Weekly history shape

Each `weekly_history` entry can include:

- `week`
- `actual_points`
- `projected_points`
- `stats` — decoded statistics for that week.

`season_summary` includes `weeks_with_stats`, `total_points`, `average_points`, `high_points`, and `low_points`.

## Player Game Active binary sensors

**Entity name:** `<Player> Game Active`  
**State:** on only while the normalized NFL game state is `in_progress`.

Attributes:

- `player_id`
- `position`
- `nfl_team`
- `opponent`
- `current_week`
- `game_status`
- `game_start`
- `roster_slot`
- `live_points`

This is intended to make game-state automations easy without parsing a Player sensor's attributes.

## Automation guidance

For simple triggers, prefer the focused entities:

- New transaction behavior → **League Activity**
- Lineup decisions → **Lineup Recommendations**
- Injury-aware automations → **Injured Players**
- Live-game automations → **Player Game Active**
- Score/matchup behavior → **Matchup**
- Individual-player behavior → that **Player** sensor.

For advanced templates, use the rich attributes on League, Roster, Matchup, and Player entities. The cards consume the same normalized model, so data visible in a card should generally have an equivalent Home Assistant representation.
\n\n## v0.1.35 additions\n\n- The **League** sensor exposes `waivers` and `waiver_order`, including ESPN waiver rank and available FAB budget context when supplied by the league.\n- Player sensors expose `biography` and `nfl_team_logo`. Biography is cached on a long interval and can include height, weight, age, birthplace, jersey, college, experience, draft details, and team history when ESPN supplies them.\n- League Activity item types distinguish `started`, `benched`, `roster_move`, `added`, `dropped`, and `traded`, with lineup slot transitions retained for roster moves.\n

## v0.1.36 additions

- Traditional waiver leagues no longer expose dormant ESPN acquisition-budget values as remaining FAB budget; budget fields are populated only when the league is positively identified as using an acquisition budget.
- Before ESPN supplies actual postseason matchup tiers, leagues with the consolation ladder enabled expose a projected **Consolation Ladder** section beneath the projected Championship Bracket. Actual ESPN postseason tier data continues to replace the projection when available.
