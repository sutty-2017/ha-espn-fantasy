from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from aiohttp import ClientSession

from .api import ESPNAuthError, ESPNError


GAMBIT_BASE_URL = "https://gambit-api.fantasy.espn.com/apis/v1"


@dataclass(slots=True)
class ESPNPickemClient:
    """Read-only client for ESPN Gambit/Pigskin Pick'em."""

    session: ClientSession
    season: int
    espn_s2: str | None = None
    swid: str | None = None

    @property
    def challenge_name(self) -> str:
        return f"nfl-pigskin-pickem-{self.season}"

    @property
    def challenge_url(self) -> str:
        return f"{GAMBIT_BASE_URL}/challenges/{self.challenge_name}"

    def _cookies(self) -> dict[str, str] | None:
        cookies: dict[str, str] = {}
        if self.espn_s2:
            cookies["espn_s2"] = self.espn_s2
        if self.swid:
            cookies["SWID"] = self.swid
        return cookies or None

    async def _get_json(
        self,
        url: str,
        *,
        params: list[tuple[str, Any]] | None = None,
        gambit_filter: dict[str, Any] | None = None,
        context: str = "ESPN Pick'em response",
    ) -> dict[str, Any] | list[Any]:
        headers = {}
        if gambit_filter is not None:
            headers["gambit-filter"] = json.dumps(gambit_filter, separators=(",", ":"))
        async with self.session.get(
            url,
            params=params,
            headers=headers or None,
            cookies=self._cookies(),
            timeout=30,
        ) as response:
            if response.status in (401, 403):
                raise ESPNAuthError("ESPN rejected the Pick'em request.")
            if response.status == 404:
                raise ESPNError(f"{context} was not found.")
            if response.status != 200:
                raise ESPNError(f"{context} returned HTTP {response.status}.")
            try:
                payload = await response.json()
            except ValueError as err:
                raise ESPNError(f"{context} returned invalid JSON.") from err
            if not isinstance(payload, (dict, list)):
                raise ESPNError(f"{context} was not a JSON object or array.")
            return payload

    async def get_challenge(
        self, scoring_period_id: int | None = None, view: str = "chui_default"
    ) -> dict[str, Any] | list[Any]:
        params: list[tuple[str, Any]] = [("view", view), ("platform", "chui")]
        if scoring_period_id is not None:
            params.append(("scoringPeriodId", scoring_period_id))
        return await self._get_json(
            self.challenge_url, params=params, context="ESPN Pick'em challenge"
        )

    async def get_group(
        self, group_id: str, view: str = "chui_default_group"
    ) -> dict[str, Any] | list[Any]:
        return await self._get_json(
            f"{self.challenge_url}/groups/{group_id}",
            params=[("view", view), ("platform", "chui")],
            gambit_filter={
                "filterSortId": {"value": None},
                "limit": 100,
                "offset": 0,
                "sortRank": {"sortAsc": True, "sortPriority": 1},
            },
            context="ESPN Pick'em group",
        )

    async def get_entry(
        self, entry_id: str, view: str = "chui_default"
    ) -> dict[str, Any] | list[Any]:
        return await self._get_json(
            f"{self.challenge_url}/entries/{entry_id}",
            params=[("view", view), ("platform", "chui")],
            context="ESPN Pick'em entry",
        )

    async def get_leaderboard(
        self, view: str = "pagetype_leaderboard"
    ) -> dict[str, Any] | list[Any]:
        return await self._get_json(
            f"{self.challenge_url}/leaderboard",
            params=[("view", view), ("platform", "chui")],
            context="ESPN Pick'em leaderboard",
        )

    async def get_propositions(
        self, challenge_id: int | str, view: str = "chui_default"
    ) -> dict[str, Any] | list[Any]:
        return await self._get_json(
            f"{GAMBIT_BASE_URL}/propositions",
            params=[
                ("challengeId", challenge_id),
                ("view", view),
                ("platform", "chui"),
            ],
            context="ESPN Pick'em propositions",
        )
