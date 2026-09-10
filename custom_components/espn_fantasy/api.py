from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from aiohttp import ClientSession

from .const import BASE_URL


class ESPNError(Exception):
    """Base ESPN API error."""


class ESPNAuthError(ESPNError):
    """ESPN authentication failed."""


@dataclass(slots=True)
class ESPNClient:
    session: ClientSession
    season: int
    league_id: int
    espn_s2: str | None = None
    swid: str | None = None

    @property
    def url(self) -> str:
        return BASE_URL.format(season=self.season, league_id=self.league_id)

    @property
    def season_url(self) -> str:
        return f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{self.season}"

    async def get_league(self) -> dict[str, Any]:
        views = [
            "mTeam",
            "mRoster",
            "mMatchup",
            "mMatchupScore",
            "mSettings",
            "mStandings",
            "mStatus",
        ]
        params = [("view", view) for view in views]
        cookies = {}
        if self.espn_s2:
            cookies["espn_s2"] = self.espn_s2
        if self.swid:
            cookies["SWID"] = self.swid

        async with self.session.get(
            self.url, params=params, cookies=cookies or None, timeout=30
        ) as response:
            if response.status in (401, 403):
                raise ESPNAuthError("ESPN rejected the request; private leagues need espn_s2 and SWID cookies.")
            if response.status == 404:
                raise ESPNError("ESPN league was not found.")
            if response.status != 200:
                raise ESPNError(f"ESPN returned HTTP {response.status}.")
            try:
                data = await response.json()
            except ValueError as err:
                raise ESPNError("ESPN returned invalid JSON.") from err

        # The season endpoint supplies the NFL schedule used to resolve each
        # rostered player's current-week opponent.
        async with self.session.get(
            self.season_url,
            params={"view": "proTeamSchedules_wl"},
            timeout=30,
        ) as response:
            if response.status != 200:
                return data
            try:
                data["pro_team_schedules"] = (await response.json()).get("settings", {}).get("proTeams", [])
            except ValueError:
                pass

        return data
