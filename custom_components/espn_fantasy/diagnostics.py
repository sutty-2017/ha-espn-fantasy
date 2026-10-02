from __future__ import annotations

from        "pickem_probe": pickem_probe,
 typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_ESPN_S2, CONF_SWID, DOMAIN
from .pickem import pickem_entry_summary
from .pickem_api import ESPNPickemClient

TO_REDACT = {CONF_ESPN_S2, CONF_SWID}


async def _async_pickem_diagnostic_probe(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    entry_id = str(entry.options.get("pickem_entry_id") or "").strip()
    if not entry_id:
        return {"status": "disabled"}
    client = ESPNPickemClient(
        async_get_clientsession(hass),
        season=int(entry.data.get("season") or 0),
        espn_s2=entry.data.get(CONF_ESPN_S2) or None,
        swid=entry.data.get(CONF_SWID) or None,
    )
    try:
        payload = await client.get_entry(entry_id)
    except Exception as err:  # noqa: BLE001
        return {"status": "error", "error_type": type(err).__name__, "message": str(err)}
    return {"status": "ok", **pickem_entry_summary(payload)}


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

    pickem_probe = await _async_pickem_diagnostic_probe(hass, entry)

    return {
        "compatibility": compatibility,
        "pickem_probe": pickem_probe,
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
