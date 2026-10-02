from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant\nfrom homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_ESPN_S2, CONF_SWID, DOMAIN\nfrom .pickem import pickem_entry_summary\nfrom .pickem_api import ESPNPickemClient

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
    coordinator_data = dict(coordinator.data)
    # League-member profiles and notification settings are not needed to
    # troubleshoot this integration. Keep team/player fantasy data, but omit
    # the member directory from downloadable diagnostics.
    coordinator_data.pop("members", None)

    normalized = coordinator_data.get("normalized") or {}
    compatibility = {
        "season": entry.data.get("season"),
        "league_id": entry.data.get("league_id"),
        "team_id": entry.data.get("team_id"),
        "scoring_period": normalized.get("scoring_period"),
        "matchup_period": normalized.get("matchup_period"),
        "capabilities": normalized.get("capabilities") or {},
        "optional_data": {
            "live_scoring": bool(coordinator_data.get("live_scoring")),
            "season_schedule": bool(coordinator_data.get("season_schedule")),
            "transactions": bool(coordinator_data.get("transactions")),
            "pro_team_schedules": bool(coordinator_data.get("pro_team_schedules")),
        },
    }

    return {
        "compatibility": compatibility,
        "entry": {
            "title": entry.title,
            "data": async_redact_data(dict(entry.data), TO_REDACT),
            "options": dict(entry.options),
        },
        "coordinator": {
            "last_update_success": coordinator.last_update_success,
            "data": coordinator_data,
        },
    }
