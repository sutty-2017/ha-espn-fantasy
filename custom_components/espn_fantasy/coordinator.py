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

    async def _async_update_data(self) -> dict:
        try:
            data = await self.client.get_league()
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
            data["normalized"] = build_normalized_model(data, team_id)

            matchup = (data["normalized"] or {}).get("matchup") or {}
            my_team = matchup.get("my_team") or {}
            for collection in ("roster", "starters"):
                for player in my_team.get(collection) or []:
                    try:
                        player["news"] = self._player_news.get(int(player.get("id")), [])
                    except (TypeError, ValueError):
                        player["news"] = []
            return data
        except ESPNError as err:
            raise UpdateFailed(str(err)) from err
