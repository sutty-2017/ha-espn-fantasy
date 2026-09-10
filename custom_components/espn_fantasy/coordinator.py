from __future__ import annotations

from datetime import timedelta
import logging

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
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)


class ESPNDataUpdateCoordinator(DataUpdateCoordinator[dict]):
    """Fetch all ESPN fantasy data once for all entities."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.entry = entry
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
            return await self.client.get_league()
        except ESPNError as err:
            raise UpdateFailed(str(err)) from err
