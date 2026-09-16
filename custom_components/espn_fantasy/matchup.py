from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_LEAGUE_ID, CONF_TEAM_ID, DOMAIN
from .coordinator import ESPNDataUpdateCoordinator
from .sensor import LINEUP_SLOT_NAMES, POSITION_NAMES, PRO_TEAM_NAMES, _current_week, _find_live_player, _stat_entry


def _teams(coordinator: ESPNDataUpdateCoordinator) -> list[dict[str, Any]]:
    return coordinator.data.get("teams", [])


def _team_name(team: dict[str, Any]) -> str:
    return team.get("name") or " ".join(filter(None, [team.get("location"), team.get("nickname")])) or f"Team {team.get('id')}"


def _team_by_id(coordinator: ESPNDataUpdateCoordinator, team_id: int | None) -> dict[str, Any] | None:
    if team_id is None:
        return None
    try:
        target = int(team_id)
    except (TypeError, ValueError):
        return None
    return next((team for team in _teams(coordinator) if int(team.get("id", -1)) == target), None)


def _current_scoring_period(coordinator: ESPNDataUpdateCoordinator) -> int | None:
    value = coordinator.data.get("status", {}).get("currentScoringPeriod")
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _current_matchup_period(coordinator: ESPNDataUpdateCoordinator) -> int | None:
    value = coordinator.data.get("status", {}).get("currentMatchupPeriod")
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _find_matchup_object(data: Any, team_id: int, matchup_period: int | None) -> dict[str, Any] | None:
    """Find a matchup by matchup period, never confusing it with scoring period."""
    if isinstance(data, dict):
        home = data.get("home")
        away = data.get("away")
        period = data.get("matchupPeriodId")
        if isinstance(home, dict) and isinstance(away, dict) and period is not None:
            try:
                period_matches = matchup_period is None or int(period) == int(matchup_period)
            except (TypeError, ValueError):
                period_matches = False
            if period_matches:
                home_id = home.get("teamId") or home.get("team_id")
                away_id = away.get("teamId") or away.get("team_id")
                if str(team_id) in {str(home_id), str(away_id)}:
                    return data
        for value in data.values():
            found = _find_matchup_object(value, team_id, matchup_period)
            if found:
                return found
    elif isinstance(data, list):
        for value in data:
            found = _find_matchup_object(value, team_id, matchup_period)
            if found:
                return found
    return None


def _schedule_matchups(coordinator: ESPNDataUpdateCoordinator, team_id: int) -> list[dict[str, Any]]:
    schedule = coordinator.data.get("season_schedule", [])
    if not isinstance(schedule, list):
        return []
    result = []
    for matchup in schedule:
        if not isinstance(matchup, dict) or matchup.get("matchupPeriodId") is None:
            continue
        home = matchup.get("home") or {}
        away = matchup.get("away") or {}
        home_id = home.get("teamId") or home.get("team_id")
        away_id = away.get("teamId") or away.get("team_id")
        if str(team_id) in {str(home_id), str(away_id)}:
            result.append(matchup)
    return sorted(result, key=lambda item: int(item.get("matchupPeriodId", 0)))


def _next_matchup(coordinator: ESPNDataUpdateCoordinator, team_id: int) -> dict[str, Any] | None:
    current = _current_matchup_period(coordinator)
    for matchup in _schedule_matchups(coordinator, team_id):
        try:
            period = int(matchup.get("matchupPeriodId"))
        except (TypeError, ValueError):
            continue
        if current is None or period > current:
            return matchup
    return None


def _score(side: dict[str, Any]) -> float | None:
    for key in ("liveScore", "totalPoints", "points", "score"):
        value = side.get(key)
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def _projection(side: dict[str, Any]) -> float | None:
    for key in ("totalProjectedPoints", "totalProjectedPointsLive", "projectedPoints", "projectedScore"):
        value = side.get(key)
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def _team_logo(pro_team_id: Any) -> str | None:
    try:
        abbreviation = PRO_TEAM_NAMES.get(int(pro_team_id))
    except (TypeError, ValueError):
        return None
    if not abbreviation:
        return None
    return f"https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/{abbreviation}.png"


def _player_summary(coordinator: ESPNDataUpdateCoordinator, team: dict[str, Any], entry: dict[str, Any]) -> dict[str, Any]:
    player = entry.get("playerPoolEntry", {}).get("player", {})
    pid = player.get("id") or entry.get("playerId")
    week = _current_scoring_period(coordinator) or _current_week(coordinator)
    actual = _stat_entry(player, week, 0)
    projected = _stat_entry(player, week, 1)
    live = _find_live_player(coordinator.data.get("live_scoring", {}), int(pid)) if pid else None
    live_points = next((live.get(k) for k in ("liveAppliedStatTotal", "appliedStatTotal", "livePoints", "points") if live and live.get(k) is not None), None)
    position = POSITION_NAMES.get(player.get("defaultPositionId"), player.get("defaultPositionId"))
    is_defense = position == "D/ST" or entry.get("lineupSlotId") == 16
    image = _team_logo(player.get("proTeamId")) if is_defense else (f"https://a.espncdn.com/i/headshots/nfl/players/full/{pid}.png" if pid else None)
    return {
        "id": pid,
        "name": player.get("fullName") or f"Player {pid}",
        "position": position,
        "lineup_slot": LINEUP_SLOT_NAMES.get(entry.get("lineupSlotId"), entry.get("lineupSlotId")),
        "nfl_team": PRO_TEAM_NAMES.get(player.get("proTeamId"), player.get("proTeamId")),
        "actual_points": actual.get("appliedTotal"),
        "projected_points": projected.get("appliedTotal", projected.get("projectedTotal")),
        "live_points": live_points,
        "headshot": image,
        "is_defense": is_defense,
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
        team_id = int(self.coordinator.entry.data[CONF_TEAM_ID])
        period = _current_matchup_period(self.coordinator)
        return (
            _find_matchup_object(self.coordinator.data.get("schedule", []), team_id, period)
            or _find_matchup_object(self.coordinator.data.get("live_scoring", {}), team_id, period)
            or _find_matchup_object(self.coordinator.data.get("season_schedule", []), team_id, period)
        )

    @property
    def _next_matchup(self) -> dict[str, Any] | None:
        team_id = int(self.coordinator.entry.data[CONF_TEAM_ID])
        return _next_matchup(self.coordinator, team_id)

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
        return _team_by_id(self.coordinator, int(opponent_id)) if opponent_id is not None else {}

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
        next_matchup = self._next_matchup
        next_home = (next_matchup or {}).get("home", {}) or {}
        next_away = (next_matchup or {}).get("away", {}) or {}
        next_home_id = next_home.get("teamId") or next_home.get("team_id")
        next_away_id = next_away.get("teamId") or next_away.get("team_id")
        next_opp_id = next_away_id if str(next_home_id) == str(my_id) else next_home_id
        next_opp_team = _team_by_id(self.coordinator, int(next_opp_id)) if next_opp_id is not None else {}
        my_score = _score(my_side)
        opp_score = _score(opp_side)
        return {
            "current_week": _current_scoring_period(self.coordinator),
            "current_matchup_period": _current_matchup_period(self.coordinator),
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
            "next_matchup_period": next_matchup.get("matchupPeriodId") if next_matchup else None,
            "next_opponent_team_id": next_opp_team.get("id") if next_opp_team else None,
            "next_opponent_team_name": _team_name(next_opp_team) if next_opp_team else None,
            "my_roster": _active_roster(self.coordinator, my_team),
            "opponent_roster": _active_roster(self.coordinator, opp_team) if opp_team else [],
        }


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ESPNDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([MatchupSensor(coordinator)])
