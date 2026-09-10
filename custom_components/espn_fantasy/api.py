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

    def _cookies(self) -> dict[str, str] | None:
        cookies: dict[str, str] = {}
        if self.espn_s2:
            cookies["espn_s2"] = self.espn_s2
        if self.swid:
            cookies["SWID"] = self.swid
        return cookies or None

    async def _get_json(self, params: Any) -> dict[str, Any]:
        async with self.session.get(
            self.url, params=params, cookies=self._cookies(), timeout=30
        ) as response:
            if response.status in (401, 403):
                raise ESPNAuthError(
                    "ESPN rejected the request; private leagues need espn_s2 and SWID cookies."
                )
            if response.status == 404:
                raise ESPNError("ESPN league was not found.")
            if response.status != 200:
                raise ESPNError(f"ESPN returned HTTP {response.status}.")
            try:
                return await response.json()
            except ValueError as err:
                raise ESPNError("ESPN returned invalid JSON.") from err

    async def get_league(self) -> dict[str, Any]:
        views = [
            "mTeam",
            "mRoster",
            "mMatchup",
            "mMatchupScore",
            "mSettings",
            "mStandings",
            "mStatus",
            "mScoreboard",
        ]
        params = [("view", view) for view in views]
        data = await self._get_json(params)

        status = data.get("status", {})
        scoring_period = (
            status.get("currentScoringPeriod")
            or status.get("currentMatchupPeriod")
        )

        # ESPN's live-scoring view exposes the current fantasy point totals while
        # NFL games are in progress. Keep this separate so sensors can fall back
        # cleanly to the normal weekly player stats when no live value exists.
        if scoring_period is not None:
            live_params = [
                ("view", "mLiveScoring"),
                ("view", "mMatchupScore"),
                ("scoringPeriodId", scoring_period),
            ]
            try:
                data["live_scoring"] = await self._get_json(live_params)
            except ESPNError:
                # Live scoring is supplemental. A temporary failure must not
                # make the whole league unavailable.
                data["live_scoring"] = {}

        # The season endpoint supplies the NFL schedule used to resolve each
        # rostered player's current-week opponent.
        async with self.session.get(
            self.season_url,
            params={"view": "proTeamSchedules_wl"},
            timeout=30,
        ) as response:
            if response.status == 200:
                try:
                    data["pro_team_schedules"] = (
                        await response.json()
                    ).get("settings", {}).get("proTeams", [])
                except ValueError:
                    pass

        return data
