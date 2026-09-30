from __future__ import annotations

import asyncio
import json
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

    def segment_url(self, segment: int) -> str:
        return f"{self.season_url}/segments/{segment}/leagues/{self.league_id}"

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

    @staticmethod
    def _merge_rosters(
        teams: list[dict[str, Any]], roster_teams: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Merge period-specific rosters into the richer team metadata."""
        roster_by_id = {
            str(team.get("id")): team
            for team in roster_teams
            if team.get("id") is not None
        }
        merged: list[dict[str, Any]] = []
        seen: set[str] = set()

        for team in teams:
            team_id = team.get("id")
            if team_id is None:
                continue
            key = str(team_id)
            combined = dict(team)
            roster_team = roster_by_id.get(key)
            if roster_team:
                combined["roster"] = roster_team.get("roster", {})
            merged.append(combined)
            seen.add(key)

        for key, roster_team in roster_by_id.items():
            if key not in seen:
                merged.append(roster_team)

        return merged

    async def get_league(self) -> dict[str, Any]:
        meta = await self._get_json(
            [
                ("view", "mTeam"),
                ("view", "mSettings"),
                ("view", "mStandings"),
                ("view", "mStatus"),
            ]
        )

        status = meta.get("status", {})
        # ESPN can expose the current scoring period at the top level of the
        # league response (for example alongside mTeam), even when mStatus does
        # not include currentScoringPeriod.
        scoring_period = self._int(meta.get("scoringPeriodId"))
        if scoring_period is None:
            scoring_period = self._int(status.get("currentScoringPeriod"))
        matchup_period = self._int(status.get("currentMatchupPeriod"))

        # mScoreboard is the fallback when the league response does not expose
        # a usable scoring period and can provide the current schedule.
        scoreboard: dict[str, Any] | None = None
        if scoring_period is None or matchup_period is None:
            scoreboard = await self._get_json([("view", "mScoreboard")])
            if scoring_period is None:
                scoring_period = self._int(scoreboard.get("scoringPeriodId"))
            if matchup_period is None:
                for game in scoreboard.get("schedule", []):
                    period = self._int(game.get("matchupPeriodId"))
                    if period is not None:
                        matchup_period = period
                        break

        if scoring_period is None:
            raise ESPNError("ESPN did not return a current scoring period from mStatus or mScoreboard.")

        roster = await self._get_json(
            [
                ("view", "mRoster"),
                ("scoringPeriodId", scoring_period),
            ]
        )
        meta["teams"] = self._merge_rosters(
            meta.get("teams", []), roster.get("teams", [])
        )

        matchup_params: list[tuple[str, Any]] = [
            ("view", "mMatchupScore"),
            ("view", "mBoxscore"),
            ("scoringPeriodId", scoring_period),
        ]
        if matchup_period is not None:
            matchup_params.append(("matchupPeriodId", matchup_period))

        matchup = await self._get_json(matchup_params)
        meta["current_matchup"] = matchup.get("schedule", [])

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

        schedule = await self._get_json([("view", "mSchedule")])
        season_schedule = list(schedule.get("schedule", []))
        # ESPN can expose consolation/placement paths only in postseason
        # segments. Merge those schedules without replacing richer segment-0 rows.
        schedule_by_id = {
            str(game.get("id")): game
            for game in season_schedule
            if isinstance(game, dict) and game.get("id") is not None
        }
        for segment in (1, 2, 3):
            try:
                async with self.session.get(
                    self.segment_url(segment),
                    params=[("view", "mSchedule")],
                    cookies=self._cookies(),
                    timeout=30,
                ) as response:
                    if response.status != 200:
                        continue
                    payload = await response.json()
            except Exception:  # noqa: BLE001
                continue
            for game in payload.get("schedule") or []:
                if not isinstance(game, dict):
                    continue
                game_id = str(game.get("id")) if game.get("id") is not None else None
                if game_id and game_id in schedule_by_id:
                    existing = schedule_by_id[game_id]
                    # Segment-specific rows can carry postseason tier/advancement
                    # metadata omitted by the whole-season representation.
                    for key, value in game.items():
                        if value is not None and (
                            key == "playoffTierType"
                            or existing.get(key) in (None, "", [], {})
                        ):
                            existing[key] = value
                    continue
                season_schedule.append(game)
                if game_id:
                    schedule_by_id[game_id] = game
        meta["season_schedule"] = season_schedule

        try:
            transactions = await self._get_json([
                ("view", "mTransactions2"),
                ("scoringPeriodId", scoring_period),
            ])
            meta["transactions"] = transactions.get("transactions", [])
        except ESPNError:
            meta["transactions"] = []

        try:
            async with self.session.get(
                self.season_url,
                params={"view": "proTeamSchedules_wl"},
                cookies=self._cookies(),
                timeout=30,
            ) as response:
                if response.status == 200:
                    try:
                        season_data = await response.json()
                        meta["pro_team_schedules"] = (
                            season_data.get("proTeamSchedules")
                            or (season_data.get("settings") or {}).get("proTeams")
                            or []
                        )
                    except ValueError:
                        meta["pro_team_schedules"] = []
                else:
                    meta["pro_team_schedules"] = []
        except Exception:  # noqa: BLE001
            meta["pro_team_schedules"] = []

        return meta

    async def get_live_matchup(
        self, scoring_period: int, matchup_period: int | None
    ) -> dict[str, Any]:
        """Fetch only the current matchup/live-scoring payload."""
        params: list[tuple[str, Any]] = [
            ("view", "mLiveScoring"),
            ("view", "mMatchupScore"),
            ("view", "mBoxscore"),
            ("scoringPeriodId", scoring_period),
        ]
        if matchup_period is not None:
            params.append(("matchupPeriodId", matchup_period))
        return await self._get_json(params)

    async def get_player_history_many(
        self, player_ids: list[int], scoring_period: int
    ) -> dict[int, list[dict[str, Any]]]:
        """Fetch each elapsed scoring period explicitly for focused players."""
        ids = list(dict.fromkeys(int(player_id) for player_id in player_ids if player_id))
        if not ids:
            return {}
        result: dict[int, list[dict[str, Any]]] = {player_id: [] for player_id in ids}
        fantasy_filter = {"players": {"filterIds": {"value": ids}}}
        for period in range(1, max(1, int(scoring_period)) + 1):
            try:
                async with self.session.get(
                    self.url,
                    params=[("view", "kona_playercard"), ("scoringPeriodId", period)],
                    headers={"X-Fantasy-Filter": json.dumps(fantasy_filter)},
                    cookies=self._cookies(),
                    timeout=30,
                ) as response:
                    if response.status != 200:
                        continue
                    payload = await response.json()
            except Exception:  # noqa: BLE001
                continue
            for item in payload.get("players") or []:
                if not isinstance(item, dict):
                    continue
                player = item.get("player") or (item.get("playerPoolEntry") or {}).get("player") or {}
                player_id = self._int(player.get("id") or item.get("id"))
                if player_id in result:
                    result[player_id].extend(
                        stat for stat in (player.get("stats") or [])
                        if self._int(stat.get("scoringPeriodId")) == period
                    )
        return result

    async def get_player_details_many(
        self, player_ids: list[int]
    ) -> dict[int, dict[str, Any]]:
        """Fetch rich ESPN player metadata for transaction/activity players."""
        ids = list(dict.fromkeys(int(player_id) for player_id in player_ids if player_id))
        if not ids:
            return {}
        fantasy_filter = {"players": {"filterIds": {"value": ids}}}
        try:
            async with self.session.get(
                self.url,
                params=[("view", "kona_playercard")],
                headers={"X-Fantasy-Filter": json.dumps(fantasy_filter)},
                cookies=self._cookies(),
                timeout=30,
            ) as response:
                if response.status != 200:
                    return {}
                payload = await response.json()
        except Exception:  # noqa: BLE001
            return {}
        result: dict[int, dict[str, Any]] = {}
        for item in payload.get("players") or []:
            player = item.get("player") or (item.get("playerPoolEntry") or {}).get("player") or {}
            player_id = self._int(player.get("id") or item.get("id"))
            if player_id is not None:
                result[player_id] = player
        return result

    async def get_player_biographies_many(
        self, player_ids: list[int]
    ) -> dict[int, dict[str, Any]]:
        """Fetch relatively static NFL profile + bio data for roster players."""
        ids = list(dict.fromkeys(int(player_id) for player_id in player_ids if player_id))
        if not ids:
            return {}
        semaphore = asyncio.Semaphore(5)

        async def _fetch(player_id: int) -> tuple[int, dict[str, Any]]:
            base = f"https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{player_id}"
            profile: dict[str, Any] = {}
            bio: dict[str, Any] = {}
            async with semaphore:
                try:
                    async with self.session.get(base, timeout=20) as response:
                        if response.status == 200:
                            payload = await response.json()
                            profile = payload.get("athlete") or payload
                except Exception:  # noqa: BLE001
                    pass
                try:
                    async with self.session.get(f"{base}/bio", timeout=20) as response:
                        if response.status == 200:
                            bio = await response.json()
                except Exception:  # noqa: BLE001
                    pass
            return player_id, {"profile": profile, "bio": bio}

        return dict(await asyncio.gather(*(_fetch(player_id) for player_id in ids)))

    async def get_player_status_many(
        self, player_ids: list[int]
    ) -> dict[int, dict[str, Any]]:
        """Fetch current injury fields for the configured roster."""
        ids = list(dict.fromkeys(int(player_id) for player_id in player_ids if player_id))
        if not ids:
            return {}
        fantasy_filter = {"players": {"filterIds": {"value": ids}}}
        try:
            async with self.session.get(
                self.url,
                params=[("view", "kona_playercard")],
                headers={"X-Fantasy-Filter": json.dumps(fantasy_filter)},
                cookies=self._cookies(),
                timeout=30,
            ) as response:
                if response.status != 200:
                    return {}
                payload = await response.json()
        except Exception:  # noqa: BLE001
            return {}
        result: dict[int, dict[str, Any]] = {}
        for item in payload.get("players") or []:
            player = item.get("player") or (item.get("playerPoolEntry") or {}).get("player") or {}
            player_id = self._int(player.get("id") or item.get("id"))
            if player_id is not None:
                result[player_id] = {"injuryStatus": player.get("injuryStatus"), "injured": player.get("injured")}
        return result

    async def get_player_news(self, player_id: int, limit: int = 5) -> list[dict[str, Any]]:
        """Fetch and normalize ESPN fantasy news for one player."""
        url = "https://site.api.espn.com/apis/fantasy/v2/games/ffl/news/players"
        try:
            async with self.session.get(
                url,
                params={"playerId": player_id, "limit": limit},
                timeout=20,
            ) as response:
                if response.status != 200:
                    return []
                payload = await response.json()
        except (TimeoutError, ValueError):
            return []
        except Exception:  # noqa: BLE001
            return []

        feed = payload.get("feed") or payload.get("articles") or []
        normalized: list[dict[str, Any]] = []
        for item in feed:
            if not isinstance(item, dict):
                continue
            links = item.get("links") or item.get("link") or []
            if isinstance(links, dict):
                links = [links]
            href = next(
                (
                    link.get("href")
                    for link in links
                    if isinstance(link, dict) and link.get("href")
                ),
                None,
            )
            normalized.append(
                {
                    "id": item.get("id") or item.get("nowId"),
                    "published": item.get("published") or item.get("publishedDate"),
                    "headline": item.get("headline") or item.get("title"),
                    "description": item.get("description") or item.get("story"),
                    "spin": item.get("spin") or item.get("analysis"),
                    "type": item.get("type"),
                    "source": item.get("source"),
                    "url": href,
                }
            )
        return normalized

    async def get_player_news_many(
        self, player_ids: list[int], limit: int = 5
    ) -> dict[int, list[dict[str, Any]]]:
        """Fetch player news with bounded concurrency so ESPN is not flooded."""
        semaphore = asyncio.Semaphore(5)

        async def _fetch(player_id: int) -> tuple[int, list[dict[str, Any]]]:
            async with semaphore:
                return player_id, await self.get_player_news(player_id, limit)

        results = await asyncio.gather(
            *(_fetch(player_id) for player_id in dict.fromkeys(player_ids))
        )
        return dict(results)

    @staticmethod
    def _int(value: Any) -> int | None:
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None
