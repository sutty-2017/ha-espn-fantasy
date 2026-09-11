from __future__ import annotations

DOMAIN = "espn_fantasy"
NAME = "ESPN Fantasy Football"
CONF_LEAGUE_ID = "league_id"
CONF_TEAM_ID = "team_id"
CONF_SEASON = "season"
CONF_ESPN_S2 = "espn_s2"
CONF_SWID = "swid"
DEFAULT_SCAN_INTERVAL = 300

# ESPN moved fantasy read requests to this host. The legacy fantasy.espn.com
# endpoint redirects to the ESPN website, which returns HTML instead of JSON.
BASE_URL = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{season}/segments/0/leagues/{league_id}"

PLATFORMS = ["sensor", "binary_sensor", "matchup"]
