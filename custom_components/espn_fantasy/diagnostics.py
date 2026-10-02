from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_ESPN_S2, CONF_SWID, DOMAIN
from .pickem import pickem_entry_summary
from .pickem_api import ESPNPickemClient

TO_REDACT = {CONF_ESPN_S2, CONF_SWID}

# Experimental development probe. This is intentionally not configuration yet:
# remove/replace it once the Gambit payload is normalized into supported entities.
PICKEM_PROBE_ENTRY_ID = "ae3faad0-bcfa-11f1-9775-6178909c6726"


async def _async_pickem_probe(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Fetch a diagnostics-safe structural view of the experimental Pick'em entry."""
    season = int(entry.data.get("season") or 0)
    if not season:
        return {"status": "skipped", "reason": "season unavailable"}

    client = ESPNPickemClient(
        hass.helpers.aiohttp_client.async_get_clientsession(hass),
        season,
        entry.data.get(CONF_ESPN_S2),
        entry.data.get(CONF_SWID),
    )
    try:
        payload = await client.get_entry(PICKEM_PROBE_ENTRY_ID)
    except Exception as err:  # noqa: BLE001 - diagnostics must not fail as a whole
        return {
            "status": "error",
            "error_type": type(err).__name__,
            "message": str(err),
        }

    return {
        "status": "ok",
        "season": season,
        "entry_id": PICKEM_PROBE_ENTRY_ID,
        **pickem_entry_summary(payload),
    }


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
        "experimental_pickem_probe": await _async_pickem_probe(hass, entry),
    }
