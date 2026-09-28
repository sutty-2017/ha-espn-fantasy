from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_ESPN_S2, CONF_SWID, DOMAIN

TO_REDACT = {CONF_ESPN_S2, CONF_SWID}


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Return diagnostics for an ESPN Fantasy config entry.

    Keep ESPN's raw league, roster, matchup, player, and game structures so
    diagnostics can be used to develop and troubleshoot the integration while
    removing the authentication cookies from the config entry.
    """
    coordinator = hass.data[DOMAIN][entry.entry_id]

    return {
        "entry": {
            "title": entry.title,
            "data": async_redact_data(dict(entry.data), TO_REDACT),
            "options": dict(entry.options),
        },
        "coordinator": {
            "last_update_success": coordinator.last_update_success,
            "data": coordinator.data,
        },
    }
