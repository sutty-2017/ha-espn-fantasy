# ESPN Fantasy Football for Home Assistant

A Home Assistant custom integration for ESPN Fantasy Football leagues.

It connects directly to ESPN's fantasy API and exposes your league, team, record, scoring totals, roster, and individual roster players as Home Assistant entities.

> **Unofficial integration:** This project is not affiliated with or endorsed by ESPN.

## Features

- UI-based Home Assistant configuration
- Public and private ESPN leagues
- League and season information
- Your team's record and scoring totals
- Current fantasy matchup week
- Roster count and roster details
- One sensor for each player on your roster
- Player attributes including position, NFL team ID, injury status, ownership, projected points, and actual points
- Coordinated polling so all entities share one ESPN API request
- HACS-compatible repository structure

## HACS installation

### Custom repository

1. Install [HACS](https://www.hacs.xyz/) if you have not already.
2. Open **HACS → Integrations**.
3. Open the three-dot menu and select **Custom repositories**.
4. Add this repository URL:

   `https://github.com/sutty-2017/ha-espn-fantasy`

5. Select **Integration** as the repository type.
6. Add the repository and install **ESPN Fantasy Football**.
7. Restart Home Assistant.
8. Go to **Settings → Devices & services → Add Integration** and search for **ESPN Fantasy Football**.

## Configuration

The integration asks for:

- **League ID** — the numeric league ID from ESPN.
- **Team ID** — your numeric team ID within that league.
- **Season** — for example `2026`.
- **ESPN S2 cookie** — required for many private leagues.
- **SWID cookie** — required for many private leagues.

For a public league, leave the cookie fields blank.

### Finding League ID and Team ID

Your ESPN Fantasy URL normally contains the league ID. The team ID is the numeric ID assigned to your team in that league. If you are unsure of the team ID, inspect the league data or use the ESPN API response.

### Private leagues

ESPN does not provide a stable public authentication flow for this API. Private leagues may require the `espn_s2` and `SWID` browser cookies from an authenticated ESPN session.

Treat these cookies like credentials. Do not commit them to GitHub, put them in issue reports, or paste them into public logs.

## Entities

The integration creates a device for the configured ESPN league/team and adds these sensors:

| Entity | Description |
| --- | --- |
| League | League name and league metadata |
| My Team | Team name and team metadata |
| Record | Wins-losses-ties |
| Points For | Total points scored |
| Points Against | Total points allowed |
| Current Week | Current ESPN matchup period |
| Roster | Number of rostered players plus roster details |
| Player sensors | One sensor for each rostered player |

Player sensors expose attributes such as:

- Player ID
- Position
- NFL team ID
- Injury status
- Ownership percentage
- Projected points
- Actual points

## API notes

This integration uses ESPN's currently observed Fantasy Football API. ESPN's fantasy API is not a documented, stable public API, so API behavior can change without notice.

The integration requests league views including team, roster, matchup, matchup score, settings, standings, and status data.

## Troubleshooting

### "Unable to retrieve the ESPN league"

Verify:

- League ID
- Season
- Internet connectivity from Home Assistant
- That the ESPN league exists for the selected season

### Authentication failure

For a private league, verify that both `espn_s2` and `SWID` are current and copied exactly from the authenticated ESPN browser session.

If ESPN changes or expires the cookies, remove and re-add the integration with fresh values.

### Entities do not appear

Restart Home Assistant after installation. If the integration was installed manually, confirm that the following path exists:

`/config/custom_components/espn_fantasy/manifest.json`

## Development

The repository is structured as a standard Home Assistant custom integration:

```text
custom_components/espn_fantasy/
├── __init__.py
├── api.py
├── config_flow.py
├── const.py
├── coordinator.py
├── manifest.json
├── sensor.py
├── strings.json
└── translations/
    └── en.json
```

GitHub Actions run HACS validation and Home Assistant's Hassfest checks on pushes and pull requests.

## License

MIT. See [LICENSE](LICENSE).
