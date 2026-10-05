from __future__ import annotations

from datetime import timedelta
import logging
import time

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import ESPNClient, ESPNError
from .const import (
    CONF_ESPN_S2,
    CONF_LEAGUE_ID,
    CONF_SEASON,
    CONF_SWID,
    CONF_TEAM_ID,
    DEFAULT_SCAN_INTERVAL,
    LIVE_SCAN_INTERVAL,
    DOMAIN,
)
from .model import build_normalized_model

_LOGGER = logging.getLogger(__name__)


class ESPNDataUpdateCoordinator(DataUpdateCoordinator[dict]):
    """Fetch all ESPN fantasy data once for all entities."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.entry = entry
        self._player_news: dict[int, list[dict]] = {}
        self._player_news_updated = 0.0
        self._player_history: dict[int, list[dict]] = {}
        self._player_history_updated = 0.0
        self._player_status: dict[int, dict] = {}
        self._player_status_updated = 0.0
        self._player_biographies: dict[int, dict] = {}
        self._player_biographies_updated = 0.0
        self._nfl_highlights: dict[int, list[dict]] = {}
        self._nfl_highlights_updated = 0.0
        self._last_full_refresh = 0.0
        self._serving_stale_data = False
        self.client = ESPNClient(
            async_get_clientsession(hass),
            season=int(entry.data[CONF_SEASON]),
            league_id=int(entry.data[CONF_LEAGUE_ID]),
            espn_s2=entry.data.get(CONF_ESPN_S2),
            swid=entry.data.get(CONF_SWID),
        )
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=DEFAULT_SCAN_INTERVAL),
        )

    def _matchup_has_live_players(self, data: dict | None) -> bool:
        matchup = ((data or {}).get("normalized") or {}).get("matchup") or {}
        for side_name in ("my_team", "opponent"):
            side = matchup.get(side_name) or {}
            if any(
                player.get("game_status") == "in_progress"
                for player in (side.get("roster") or [])
            ):
                return True
        return False

    async def _async_update_data(self) -> dict:
        try:
            now = time.monotonic()
            if (
                self.data
                and self._matchup_has_live_players(self.data)
                and now - self._last_full_refresh < DEFAULT_SCAN_INTERVAL
            ):
                scoring_period = (self.data.get("normalized") or {}).get("scoring_period")
                matchup_period = (self.data.get("normalized") or {}).get("matchup_period")
                if scoring_period:
                    live = await self.client.get_live_matchup(
                        int(scoring_period),
                        int(matchup_period) if matchup_period is not None else None,
                    )
                    data = dict(self.data)
                    data["live_scoring"] = live
                    if live.get("schedule"):
                        data["current_matchup"] = live["schedule"]
                    team_id = int(self.entry.data[CONF_TEAM_ID])
                    data["normalized"] = build_normalized_model(data, team_id)
                    matchup = (data["normalized"] or {}).get("matchup") or {}
                    my_team = matchup.get("my_team") or {}
                    for collection in ("roster", "starters"):
                        for player in my_team.get(collection) or []:
                            try:
                                player["news"] = self._player_news.get(int(player.get("id")), [])
                            except (TypeError, ValueError):
                                player["news"] = []
                    self.update_interval = timedelta(seconds=LIVE_SCAN_INTERVAL)
                    return data

            data = await self.client.get_league()
            self._last_full_refresh = now
            team_id = int(self.entry.data[CONF_TEAM_ID])
            player_ids: list[int] = []
            for team in data.get("teams") or []:
                try:
                    if int(team.get("id", -1)) != team_id:
                        continue
                except (TypeError, ValueError):
                    continue
                for roster_entry in (team.get("roster") or {}).get("entries") or []:
                    player = (roster_entry.get("playerPoolEntry") or {}).get("player") or {}
                    player_id = player.get("id") or roster_entry.get("playerId")
                    try:
                        player_ids.append(int(player_id))
                    except (TypeError, ValueError):
                        continue

            current_player_ids = set(player_ids)
            self._player_history = {
                player_id: items
                for player_id, items in self._player_history.items()
                if player_id in current_player_ids
            }
            scoring_period = data.get("scoringPeriodId")
            if scoring_period is None:
                scoring_period = (data.get("status") or {}).get("currentScoringPeriod")
            try:
                scoring_period = int(scoring_period)
            except (TypeError, ValueError):
                scoring_period = None

            now = time.monotonic()
            history_missing = any(
                player_id not in self._player_history for player_id in player_ids
            )
            if player_ids and scoring_period and (
                history_missing or now - self._player_history_updated >= 21600
            ):
                fetched_history = await self.client.get_player_history_many(
                    player_ids, scoring_period
                )
                for player_id in player_ids:
                    self._player_history[player_id] = fetched_history.get(player_id, [])
                self._player_history_updated = now

            # Merge focused historical rows into the current roster payload so
            # normalization has one defensive path regardless of ESPN response shape.
            for team in data.get("teams") or []:
                try:
                    if int(team.get("id", -1)) != team_id:
                        continue
                except (TypeError, ValueError):
                    continue
                for roster_entry in (team.get("roster") or {}).get("entries") or []:
                    player = (roster_entry.get("playerPoolEntry") or {}).get("player") or {}
                    try:
                        player_id = int(player.get("id") or roster_entry.get("playerId"))
                    except (TypeError, ValueError):
                        continue
                    historical = self._player_history.get(player_id) or []
                    if historical:
                        existing = list(player.get("stats") or [])
                        keyed = {}
                        for stat in [*existing, *historical]:
                            key = (
                                stat.get("seasonId"),
                                stat.get("scoringPeriodId"),
                                stat.get("statSourceId"),
                                stat.get("statSplitTypeId"),
                            )
                            keyed[key] = stat
                        player["stats"] = list(keyed.values())

            # Biography/profile data changes rarely. Cache it for a day and merge
            # it into the same roster player objects consumed by normalization.
            if player_ids and (
                not self._player_biographies
                or now - self._player_biographies_updated >= 86400
            ):
                fetched_bios = await self.client.get_player_biographies_many(player_ids)
                for player_id, payload in fetched_bios.items():
                    profile = payload.get("profile") or {}
                    bio = payload.get("bio") or {}
                    birth = profile.get("birthPlace") or {}
                    college = profile.get("college") or {}
                    position = profile.get("position") or {}
                    draft = profile.get("draft") or {}
                    experience = profile.get("experience") or {}
                    team_history = [
                        {
                            "team_id": item.get("id"),
                            "team_name": item.get("displayName"),
                            "logo": item.get("logo"),
                            "seasons": item.get("seasons"),
                        }
                        for item in (bio.get("teamHistory") or [])
                        if isinstance(item, dict)
                    ]
                    normalized_bio = {
                        "height": profile.get("displayHeight"),
                        "weight": profile.get("displayWeight"),
                        "age": profile.get("age"),
                        "date_of_birth": profile.get("dateOfBirth"),
                        "birthplace": ", ".join(
                            str(birth.get(key)) for key in ("city", "state", "country")
                            if birth.get(key)
                        ) or None,
                        "jersey": profile.get("jersey"),
                        "position": position.get("displayName") or position.get("abbreviation"),
                        "experience": experience.get("years") if isinstance(experience, dict) else experience,
                        "debut_year": profile.get("debutYear"),
                        "college": college.get("name") if isinstance(college, dict) else college,
                        "draft": {
                            "year": draft.get("year"),
                            "round": draft.get("round"),
                            "selection": draft.get("selection"),
                            "team": (draft.get("team") or {}).get("displayName") if isinstance(draft.get("team"), dict) else None,
                        } if isinstance(draft, dict) and draft else {},
                        "team_history": team_history,
                    }
                    if any(value not in (None, "", [], {}) for value in normalized_bio.values()):
                        self._player_biographies[player_id] = normalized_bio
                self._player_biographies_updated = now
            self._player_biographies = {
                player_id: item for player_id, item in self._player_biographies.items()
                if player_id in current_player_ids
            }
            for team in data.get("teams") or []:
                for roster_entry in (team.get("roster") or {}).get("entries") or []:
                    player = (roster_entry.get("playerPoolEntry") or {}).get("player") or {}
                    try:
                        player_id = int(player.get("id") or roster_entry.get("playerId"))
                    except (TypeError, ValueError):
                        continue
                    if player_id in self._player_biographies:
                        player["biography"] = self._player_biographies[player_id]

            # Injury fields are not consistently included in mRoster. Enrich the
            # same roster player objects used by normalization so every card sees
            # one shared status value.
            if player_ids and (
                not self._player_status or now - self._player_status_updated >= 900
            ):
                fetched_status = await self.client.get_player_status_many(player_ids)
                if fetched_status:
                    self._player_status.update(fetched_status)
                self._player_status_updated = now
            self._player_status = {
                player_id: item for player_id, item in self._player_status.items()
                if player_id in current_player_ids
            }
            for team in data.get("teams") or []:
                for roster_entry in (team.get("roster") or {}).get("entries") or []:
                    player = (roster_entry.get("playerPoolEntry") or {}).get("player") or {}
                    try:
                        player_id = int(player.get("id") or roster_entry.get("playerId"))
                    except (TypeError, ValueError):
                        continue
                    status = self._player_status.get(player_id) or {}
                    if status.get("injuryStatus") not in (None, ""):
                        player["injuryStatus"] = status["injuryStatus"]
                    if status.get("injured") is not None:
                        player["injured"] = status["injured"]

            # Activity can reference free agents or recently dropped players that
            # are not on the configured roster. Resolve those IDs separately so
            # transaction cards can show friendly names, photos, positions, and NFL teams.
            transaction_player_ids: list[int] = []
            for transaction in data.get("transactions") or []:
                for item in transaction.get("items") or []:
                    try:
                        transaction_player_ids.append(int(item.get("playerId")))
                    except (TypeError, ValueError):
                        continue
            data["transaction_players"] = await self.client.get_player_details_many(
                transaction_player_ids
            ) if transaction_player_ids else {}

            # Keep the news cache scoped to the current roster so dropped/traded
            # players do not accumulate in Home Assistant state attributes.
            current_player_ids = set(player_ids)
            self._player_news = {
                player_id: items
                for player_id, items in self._player_news.items()
                if player_id in current_player_ids
            }

            now = time.monotonic()
            if player_ids and (
                not self._player_news or now - self._player_news_updated >= 1800
            ):
                fetched_news = await self.client.get_player_news_many(player_ids)
                for player_id, items in fetched_news.items():
                    if items or player_id not in self._player_news:
                        self._player_news[player_id] = items
                self._player_news_updated = now

            data["player_news"] = self._player_news
            # Highlights are public NFL game media. Fetch once per game and refresh
            # periodically so newly published clips appear without hammering ESPN.
            pre_normalized = build_normalized_model(data, team_id)
            my_team_preview = ((pre_normalized.get("matchup") or {}).get("my_team") or {})
            roster_preview = my_team_preview.get("roster") or []
            game_ids = sorted({
                int(player.get("game_id"))
                for player in roster_preview
                if player.get("game_id")
            })
            if game_ids and (
                not self._nfl_highlights
                or now - self._nfl_highlights_updated >= 900
            ):
                fetched_highlights = await self.client.get_nfl_highlights_many(game_ids)
                for game_id in game_ids:
                    if fetched_highlights.get(game_id) or game_id not in self._nfl_highlights:
                        self._nfl_highlights[game_id] = fetched_highlights.get(game_id, [])
                self._nfl_highlights_updated = now
            self._nfl_highlights = {
                game_id: items for game_id, items in self._nfl_highlights.items()
                if game_id in set(game_ids)
            }
            team_highlights: list[dict] = []
            seen_highlights: set[str] = set()
            for player in roster_preview:
                game_id = player.get("game_id")
                player_name = str(player.get("name") or "").strip()
                if not game_id:
                    player["highlights"] = []
                    continue
                matched: list[dict] = []
                name_parts = [part.lower() for part in player_name.split() if len(part) > 2]
                for highlight in self._nfl_highlights.get(int(game_id), []):
                    key = str(highlight.get("id") or highlight.get("source") or "")
                    haystack = " ".join(str(highlight.get(field) or "") for field in ("headline", "description")).lower()
                    keywords = " ".join(str(item) for item in (highlight.get("keywords") or [])).lower()
                    exact_name = bool(player_name and player_name.lower() in f"{haystack} {keywords}")
                    surname = name_parts[-1] if len(name_parts) >= 2 else ""
                    strong_surname = bool(surname and surname in f"{haystack} {keywords}")
                    if exact_name or strong_surname:
                        player_highlight = {**highlight, "player_id": player.get("id"), "player_name": player_name}
                        matched.append(player_highlight)
                        if key and key not in seen_highlights:
                            seen_highlights.add(key)
                            team_highlights.append(player_highlight)
                player["highlights"] = matched
            data["team_highlights"] = team_highlights
            data["normalized"] = pre_normalized
            normalized_my_team = ((data["normalized"].get("matchup") or {}).get("my_team") or {})
            by_id = {int(item.get("id")): item for item in roster_preview if item.get("id")}
            for player in normalized_my_team.get("roster") or []:
                try:
                    player["highlights"] = by_id.get(int(player.get("id")), {}).get("highlights", [])
                except (TypeError, ValueError):
                    player["highlights"] = []
            self.update_interval = timedelta(
                seconds=LIVE_SCAN_INTERVAL if self._matchup_has_live_players(data) else DEFAULT_SCAN_INTERVAL
            )

            matchup = (data["normalized"] or {}).get("matchup") or {}
            my_team = matchup.get("my_team") or {}
            for collection in ("roster", "starters"):
                for player in my_team.get(collection) or []:
                    try:
                        player["news"] = self._player_news.get(int(player.get("id")), [])
                    except (TypeError, ValueError):
                        player["news"] = []
            if self._serving_stale_data:
                _LOGGER.info("ESPN Fantasy refresh recovered after a transient API failure.")
                self._serving_stale_data = False
            return data
        except ESPNError as err:
            if self.data:
                if not self._serving_stale_data:
                    _LOGGER.warning(
                        "ESPN Fantasy refresh failed; keeping last known-good data: %s",
                        err,
                    )
                else:
                    _LOGGER.debug(
                        "ESPN Fantasy refresh still failing; keeping last known-good data: %s",
                        err,
                    )
                self._serving_stale_data = True
                return self.data
            raise UpdateFailed(str(err)) from err
