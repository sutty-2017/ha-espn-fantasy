from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import CONF_ESPN_S2, CONF_SWID, DOMAIN

TO_REDACT = {CONF_ESPN_S2, CONF_SWID}
MAX_TRANSACTIONS = 25


def _team_summary(team: dict[str, Any]) -> dict[str, Any]:
    """Keep league/team structure without duplicating every roster payload."""
    return {
        key: team.get(key)
        for key in (
            "id",
            "name",
            "location",
            "nickname",
            "abbrev",
            "logo",
            "divisionId",
            "playoffSeed",
            "rankCalculatedFinal",
            "rankFinal",
            "waiverRank",
            "points",
            "pointsFor",
            "pointsAgainst",
            "record",
            "transactionCounter",
        )
        if key in team
    }


def _schedule_summary(matchup: dict[str, Any]) -> dict[str, Any]:
    """Keep schedule/bracket fields while omitting repeated roster blobs."""
    result = {
        key: matchup.get(key)
        for key in (
            "id",
            "matchupPeriodId",
            "playoffTierType",
            "winner",
        )
        if key in matchup
    }
    for side_name in ("home", "away"):
        side = matchup.get(side_name)
        if not isinstance(side, dict):
            continue
        result[side_name] = {
            key: side.get(key)
            for key in (
                "teamId",
                "totalPoints",
                "totalProjectedPoints",
                "totalProjectedPointsLive",
                "cumulativeScore",
            )
            if key in side
        }
    return result


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Return bounded, privacy-conscious diagnostics for an ESPN Fantasy entry."""
    coordinator = hass.data[DOMAIN][entry.entry_id]
    data = coordinator.data or {}
    normalized = data.get("normalized") or {}
    league = normalized.get("league") or {}
    matchup = normalized.get("matchup") or {}

    compatibility = {
        "season": entry.data.get("season"),
        "league_id": entry.data.get("league_id"),
        "team_id": entry.data.get("team_id"),
        "scoring_period": normalized.get("scoring_period"),
        "matchup_period": normalized.get("matchup_period"),
        "capabilities": normalized.get("capabilities") or {},
        "optional_data": {
            "live_scoring": bool(data.get("live_scoring")),
            "season_schedule": bool(data.get("season_schedule")),
            "transactions": bool(data.get("transactions")),
            "pro_team_schedules": bool(data.get("pro_team_schedules")),
        },
        "counts": {
            "teams": len(data.get("teams") or []),
            "season_schedule": len(data.get("season_schedule") or []),
            "transactions": len(data.get("transactions") or []),
            "league_schedule": len(league.get("schedule") or []),
            "activity": len(league.get("activity") or []),
        },
    }

    return {
        "compatibility": compatibility,
        "entry": {
            "title": entry.title,
            "data": async_redact_data(dict(entry.data), TO_REDACT),
        },
        "coordinator": {
            "last_update_success": coordinator.last_update_success,
            "serving_stale_data": bool(getattr(coordinator, "_serving_stale_data", False)),
            "raw": {
                "status": data.get("status") or {},
                "settings": data.get("settings") or {},
                "teams": [
                    _team_summary(team)
                    for team in (data.get("teams") or [])
                    if isinstance(team, dict)
                ],
                "current_matchup": [
                    _schedule_summary(item)
                    for item in (data.get("current_matchup") or [])
                    if isinstance(item, dict)
                ],
                "season_schedule": [
                    _schedule_summary(item)
                    for item in (data.get("season_schedule") or [])
                    if isinstance(item, dict)
                ],
                "transactions": (data.get("transactions") or [])[:MAX_TRANSACTIONS],
            },
            "normalized": {
                "capabilities": normalized.get("capabilities") or {},
                "league": {
                    "standings": league.get("standings") or [],
                    "scoreboard": league.get("scoreboard") or [],
                    "schedule": league.get("schedule") or [],
                    "schedule_periods": league.get("schedule_periods") or [],
                    "playoff_bracket": league.get("playoff_bracket") or {},
                    "waivers": league.get("waivers") or {},
                    "activity": (league.get("activity") or [])[:MAX_TRANSACTIONS],
                },
                "matchup": matchup,
            },
        },
    }
