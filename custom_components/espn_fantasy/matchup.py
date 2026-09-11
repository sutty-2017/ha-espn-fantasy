from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_LEAGUE_ID, CONF_TEAM_ID, DOMAIN
from .coordinator import ESPNDataUpdateCoordinator
from .sensor import LINEUP_SLOT_NAMES, POSITION_NAMES, _current_week, _find_live_player, _stat_entry


def _teams(coordinator: ESPNDataUpdateCoordinator) -> list[dict[str, Any]]:
    return coordinator.data.get("teams", [])


def _team_name(team: dict[str, Any]) -> str:
    return team.get("name") or " ".join(filter(None, [team.get("location"), team.get("nickname")])) or f"Team {team.get('id')}"


def _team_by_id(coordinator: ESPNDataUpdateCoordinator, team_id: int | None) -> dict[str, Any] | None:
    if team_id is None:
        return None
    return next((team for team in _teams(coordinator) if int(team.get("id", -1)) == int(team_id)), None)


def _find_matchup_object(data: Any, team_id: int, week: int | None) -> dict[str, Any] | None:
    if isinstance(data, dict):
        home = data.get("home")
        away = data.get("away")
        period = data.get("matchupPeriodId") or data.get("scoringPeriodId")
        if isinstance(home, dict) and isinstance(away, dict) and period is not None:
            if week is None or int(period) == int(week):
                home_id = home.get("teamId") or home.get("team_id")
                away_id = away.get("teamId") or away.get("team_id")
                if str(team_id) in {str(home_id), str(away_id)}:
                    return data
        for value in data.values():
            found = _find_matchup_object(value, team_id, week)
            if found:
                return found
    elif isinstance(data, list):
        for value in data:
            found = _find_matchup_object(value, team_id, week)
            if found:
                return found
    return None


def _score(side: dict[str, Any]) -> float | None:
    for key in ("liveScore", "totalPoints", "points", "score"):
        value = side.get(key)
        if isinstance(value, (int, float)):
            return value
    return None


def _projection(side: dict[str, Any]) -> float | None:
    for key in ("totalProjectedPoints", "projectedPoints", "projectedScore"):
        value = side.get(key)
        if isinstance(value, (int, float)):
            return value
    return None


def _roster_entry(team: dict[str, Any], player_id: int) -> dict[str, Any]:
    return next(
        (entry for entry in team.get("roster", {}).get("entries", [])
         if int(entry.get("playerId", entry.get("playerPoolEntry", {}).get("id", -1))) == int(player_id)),
        {},
    )


def _player_summary(coordinator: ESPNDataUpdateCoordinator, team: dict[str, Any], entry: dict[str, Any]) -> dict[str, Any]:
    player = entry.get("playerPoolEntry", {}).get("player", {})
    pid = player.get("id") or entry.get("playerId")
    week = _current_week(coordinator)
    actual = _stat_entry(player, week, 0)
    projected = _stat_entry(player, week, 1)
    live = _find_live_player(coordinator.data.get("live_scoring", {}), int(pid)) if pid else None
    live_points = next((live.get(k) for k in ("liveAppliedStatTotal", "appliedStatTotal", "livePoints", "points") if live and live.get(k) is not None), None)
    return {
        "id": pid,
        "name": player.get("fullName") or f"Player {pid}",
        "position": POSITION_NAMES.get(player.get("defaultPositionId"), player.get("defaultPositionId")),
        "lineup_slot": LINEUP_SLOT_NAMES.get(entry.get("lineupSlotId"), entry.get("lineupSlotId")),
        "nfl_team": player.get("proTeamId"),
        "actual_points": actual.get("appliedTotal"),
        "projected_points": projected.get("appliedTotal", projected.get("projectedTotal")),
        "live_points": live_points,
        "headshot": f"https://a.espncdn.com/i/headshots/nfl/players/full/{pid}.png" if pid else None,
        "active": player.get("active"),
        "injury_status": player.get("injuryStatus"),
    }


def _active_roster(coordinator: ESPNDataUpdateCoordinator, team: dict[str, Any]) -> list[dict[str, Any]]:
    entries = team.get("roster", {}).get("entries", [])
    result = []
    for entry in entries:
        slot = LINEUP_SLOT_NAMES.get(entry.get("lineupSlotId"), entry.get("lineupSlotId"))
        if slot in {"Bench", "IR"}:
            continue
        player = entry.get("playerPoolEntry", {}).get("player", {})
        if player.get("id"):
            result.append(_player_summary(coordinator, team, entry))
    order = {slot: index for index, slot in enumerate(("QB", "RB", "WR", "TE", "FLEX", "K", "D/ST"))}
    return sorted(result, key=lambda item: (order.get(item.get("lineup_slot"), 99), str(item.get("name"))))


class MatchupSensor(CoordinatorEntity[ESPNDataUpdateCoordinator], SensorEntity):
    _attr_has_entity_name = True
    _attr_native_unit_of_measurement = "points"

    def __init__(self, coordinator: ESPNDataUpdateCoordinator) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}_matchup"
        self._attr_name = "Matchup"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, coordinator.entry.entry_id)},
            "name": f"ESPN Fantasy {coordinator.entry.data[CONF_LEAGUE_ID]}",
            "manufacturer": "ESPN",
            "model": "Fantasy Football",
        }

    @property
    def _my_team(self) -> dict[str, Any]:
        return _team_by_id(self.coordinator, int(self.coordinator.entry.data[CONF_TEAM_ID])) or {}

    @property
    def _matchup(self) -> dict[str, Any] | None:
        week = _current_week(self.coordinator)
        team_id = int(self.coordinator.entry.data[CONF_TEAM_ID])
        return _find_matchup_object(self.coordinator.data, team_id, week) or _find_matchup_object(self.coordinator.data.get("live_scoring", {}), team_id, week)

    @property
    def _sides(self) -> tuple[dict[str, Any], dict[str, Any]]:
        matchup = self._matchup or {}
        return matchup.get("home", {}) or {}, matchup.get("away", {}) or {}

    @property
    def _opponent_team(self) -> dict[str, Any]:
        my_id = int(self.coordinator.entry.data[CONF_TEAM_ID])
        home, away = self._sides
        home_id = home.get("teamId") or home.get("team_id")
        away_id = away.get("teamId") or away.get("team_id")
        opponent_id = away_id if str(home_id) == str(my_id) else home_id
        return _team_by_id(self.coordinator, int(opponent_id)) or {}

    @property
    def native_value(self) -> float | None:
        my_id = int(self.coordinator.entry.data[CONF_TEAM_ID])
        home, away = self._sides
        side = home if str(home.get("teamId")) == str(my_id) else away
        return _score(side)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        my_id = int(self.coordinator.entry.data[CONF_TEAM_ID])
        home, away = self._sides
        my_side = home if str(home.get("teamId")) == str(my_id) else away
        opp_side = away if my_side is home else home
        my_team = self._my_team
        opp_team = self._opponent_team
        my_score = _score(my_side)
        opp_score = _score(opp_side)
        return {
            "current_week": _current_week(self.coordinator),
            "team_id": my_team.get("id"),
            "team_name": _team_name(my_team),
            "team_score": my_score,
            "team_projected_score": _projection(my_side),
            "opponent_team_id": opp_team.get("id"),
            "opponent_team_name": _team_name(opp_team) if opp_team else "Unknown",
            "opponent_score": opp_score,
            "opponent_projected_score": _projection(opp_side),
            "point_differential": my_score - opp_score if isinstance(my_score, (int, float)) and isinstance(opp_score, (int, float)) else None,
            "result": "WIN" if isinstance(my_score, (int, float)) and isinstance(opp_score, (int, float)) and my_score > opp_score else "LOSS" if isinstance(my_score, (int, float)) and isinstance(opp_score, (int, float)) and my_score < opp_score else "TIE" if isinstance(my_score, (int, float)) and isinstance(opp_score, (int, float)) else "UNKNOWN",
            "my_roster": _active_roster(self.coordinator, my_team),
            "opponent_roster": _active_roster(self.coordinator, opp_team) if opp_team else [],
        }


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ESPNDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([MatchupSensor(coordinator)])
