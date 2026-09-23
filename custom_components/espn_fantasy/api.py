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
        # First get league metadata. We need status before requesting any
        # period-specific roster/matchup data.
        meta = await self._get_json(
            [
                ("view", "mTeam"),
                ("view", "mSettings"),
                ("view", "mStandings"),
                ("view", "mStatus"),
            ]
        )

        status = meta.get("status", {})
        scoring_period = self._int(status.get("currentScoringPeriod"))
        matchup_period = self._int(status.get("currentMatchupPeriod"))
        if scoring_period is None:
            raise ESPNError("ESPN did not return a current scoring period.")

        # Roster data is explicitly tied to the current scoring period.
        roster = await self._get_json(
            [
                ("view", "mRoster"),
                ("scoringPeriodId", scoring_period),
            ]
        )
        meta["teams"] = roster.get("teams", meta.get("teams", []))

        # Matchup/boxscore data is explicitly tied to BOTH periods. This is
        # important because ESPN distinguishes a scoring period from a matchup
        # period, and several views otherwise return a misleading schedule.
        matchup_params: list[tuple[str, Any]] = [
            ("view", "mMatchupScore"),
            ("view", "mBoxscore"),
            ("scoringPeriodId", scoring_period),
        ]
        if matchup_period is not None:
            matchup_params.append(("matchupPeriodId", matchup_period))

        matchup = await self._get_json(matchup_params)
        meta["current_matchup"] = matchup.get("schedule", [])

        # Live scoring is supplemental. It uses the scoring period and can be
        # stale/empty outside active NFL games, so failure here is non-fatal.
        try:
            live = await self._get_json(
                [
                    ("view", "mLiveScoring"),
                    ("view", "mMatchupScore"),
                    ("scoringPeriodId", scoring_period),
                ]
            )
            meta["live_scoring"] = live
        except ESPNError:
            meta["live_scoring"] = {}

        # Full season schedule is the source of truth for future opponents.
        schedule = await self._get_json([("view", "mSchedule")])
        meta["season_schedule"] = schedule.get("schedule", [])

        # NFL schedule is used for player opponent labels.
        try:
            async with self.session.get(
                self.season_url,
                params={"view": "proTeamSchedules_wl"},
                cookies=self._cookies(),
                timeout=30,
            ) as response:
                if response.status == 200:
                    try:
                        meta["pro_team_schedules"] = (
                            await response.json()
                        ).get("proTeamSchedules", [])
                    except ValueError:
                        meta["pro_team_schedules"] = []
                else:
                    meta["pro_team_schedules"] = []
        except Exception:  # noqa: BLE001
            meta["pro_team_schedules"] = []

        return meta

    @staticmethod
    def _int(value: Any) -> int | None:
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None
