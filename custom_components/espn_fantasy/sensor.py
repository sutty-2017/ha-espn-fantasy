from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_LEAGUE_ID, CONF_SEASON, CONF_TEAM_ID, DOMAIN
from .coordinator import ESPNDataUpdateCoordinator

POSITION_NAMES = {
    1: "QB",
    2: "RB",
    3: "WR",
    4: "TE",
    5: "K",
    16: "D/ST",
}

LINEUP_SLOT_NAMES = {
    0: "QB",
    2: "RB",
    4: "WR",
    6: "TE",
    16: "D/ST",
    17: "K",
    20: "Bench",
    21: "IR",
    23: "FLEX",
}

PRO_TEAM_NAMES = {
    1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL",
    7: "DEN", 8: "DET", 9: "GB", 10: "TEN", 11: "IND", 12: "KC",
    13: "LV", 14: "LAR", 15: "MIA", 16: "MIN", 17: "NE", 18: "NO",
    19: "NYG", 20: "NYJ", 21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC",
    25: "SF", 26: "SEA", 27: "TB", 28: "WSH", 29: "CAR", 30: "JAX",
    33: "BAL", 34: "HOU",
}

# ESPN's football stat ids. We keep the raw values that ESPN supplies for the
# current scoring period and decode the common stat names for HA attributes.
STAT_NAMES = {
    0: "passing_attempts", 1: "passing_completions", 2: "passing_incompletions",
    3: "passing_yards", 4: "passing_touchdowns", 15: "passing_40_plus_yard_tds",
    16: "passing_50_plus_yard_tds", 17: "passing_300_to_399_yard_games",
    18: "passing_400_plus_yard_games", 19: "passing_2pt_conversions",
    20: "passing_interceptions", 21: "passing_completion_percentage",
    23: "rushing_attempts", 24: "rushing_yards", 25: "rushing_touchdowns",
    26: "rushing_2pt_conversions", 35: "rushing_40_plus_yard_tds",
    36: "rushing_50_plus_yard_tds", 37: "rushing_100_to_199_yard_games",
    38: "rushing_200_plus_yard_games", 39: "rushing_yards_per_attempt",
    41: "receiving_receptions", 42: "receiving_yards", 43: "receiving_touchdowns",
    44: "receiving_2pt_conversions", 45: "receiving_40_plus_yard_tds",
    46: "receiving_50_plus_yard_tds", 53: "receiving_receptions",
    56: "receiving_100_to_199_yard_games", 57: "receiving_200_plus_yard_games",
    58: "receiving_targets", 59: "receiving_yards_after_catch",
    60: "receiving_yards_per_reception", 62: "two_point_conversions",
    63: "fumble_recovery_touchdowns", 64: "times_sacked", 68: "fumbles",
    72: "fumbles_lost", 73: "turnovers", 74: "field_goals_made_50_plus",
    75: "field_goals_attempted_50_plus", 76: "field_goals_missed_50_plus",
    77: "field_goals_made_40_to_49", 78: "field_goals_attempted_40_to_49",
    79: "field_goals_missed_40_to_49", 80: "field_goals_made_under_40",
    81: "field_goals_attempted_under_40", 82: "field_goals_missed_under_40",
    83: "field_goals_made", 84: "field_goals_attempted", 85: "field_goals_missed",
    86: "extra_points_made", 87: "extra_points_attempted", 88: "extra_points_missed",
    89: "defensive_0_points_allowed", 90: "defensive_1_to_6_points_allowed",
    91: "defensive_7_to_13_points_allowed", 92: "defensive_14_to_17_points_allowed",
    93: "defensive_blocked_kick_tds", 94: "defensive_touchdowns",
    95: "defensive_interceptions", 96: "defensive_fumbles_recovered",
    97: "defensive_blocked_kicks", 98: "defensive_safeties", 99: "defensive_sacks",
    101: "kickoff_return_touchdowns", 102: "punt_return_touchdowns",
    103: "interception_return_touchdowns", 104: "fumble_return_touchdowns",
    105: "defensive_plus_special_teams_touchdowns", 106: "defensive_forced_fumbles",
    107: "defensive_assisted_tackles", 108: "defensive_solo_tackles",
    109: "defensive_total_tackles", 113: "defensive_passes_defensed",
    114: "kickoff_return_yards", 115: "punt_return_yards", 118: "punts_returned",
    120: "defensive_points_allowed", 127: "defensive_yards_allowed",
    138: "net_punts", 139: "punt_yards", 140: "punts_inside_10",
    141: "punts_inside_20", 142: "blocked_punts", 145: "punt_touchbacks",
    146: "punt_fair_catches", 147: "punt_average",
}


def _team(coordinator: ESPNDataUpdateCoordinator) -> dict[str, Any] | None:
    team_id = int(coordinator.entry.data[CONF_TEAM_ID])
    return next(
        (t for t in coordinator.data.get("teams", []) if int(t.get("id", -1)) == team_id),
        None,
    )


def _record(team: dict[str, Any]) -> dict[str, int]:
    record = team.get("record", {})
    overall = record.get("overall", record)
    return {
        "wins": int(overall.get("wins", 0)),
        "losses": int(overall.get("losses", 0)),
        "ties": int(overall.get("ties", 0)),
    }


def _current_week(coordinator: ESPNDataUpdateCoordinator) -> int | None:
    status = coordinator.data.get("status", {})
    return status.get("currentScoringPeriod") or status.get("currentMatchupPeriod")


def _stats_for_week(player: dict[str, Any], week: int | None) -> list[dict[str, Any]]:
    stats = player.get("stats") or []
    if week is None:
        return stats
    return [stat for stat in stats if stat.get("scoringPeriodId") == week]


def _stat_entry(
    player: dict[str, Any], week: int | None, source_id: int
) -> dict[str, Any]:
    stats = _stats_for_week(player, week)
    matching = [
        stat for stat in stats
        if stat.get("statSourceId") == source_id and stat.get("statSplitTypeId") in (1, None)
    ]
    return matching[0] if matching else {}


def _season_stat_entry(player: dict[str, Any], source_id: int) -> dict[str, Any]:
    stats = player.get("stats") or []
    matching = [
        stat for stat in stats
        if stat.get("statSourceId") == source_id and stat.get("statSplitTypeId") == 0
    ]
    return matching[0] if matching else {}


def _decode_stats(stat_entry: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for raw_id, value in (stat_entry.get("stats") or {}).items():
        try:
            stat_id = int(raw_id)
        except (TypeError, ValueError):
            stat_id = -1
        name = STAT_NAMES.get(stat_id, f"stat_{raw_id}")
        result[name] = value
    return result


def _find_roster_entry(coordinator: ESPNDataUpdateCoordinator, player_id: int) -> dict[str, Any]:
    roster = (_team(coordinator) or {}).get("roster", {}).get("entries", [])
    return next(
        (entry for entry in roster if int(entry.get("playerId", entry.get("playerPoolEntry", {}).get("id", -1))) == int(player_id)),
        {},
    )


def _find_live_player(data: Any, player_id: int) -> dict[str, Any] | None:
    """Find ESPN's live player record without depending on one response shape."""
    if isinstance(data, dict):
        candidate_id = data.get("playerId")
        if candidate_id is not None and str(candidate_id) == str(player_id):
            if any(key in data for key in ("appliedStatTotal", "liveAppliedStatTotal", "points", "livePoints")):
                return data
        for value in data.values():
            found = _find_live_player(value, player_id)
            if found:
                return found
    elif isinstance(data, list):
        for value in data:
            found = _find_live_player(value, player_id)
            if found:
                return found
    return None


def _opponent(coordinator: ESPNDataUpdateCoordinator, player: dict[str, Any]) -> str | None:
    pro_team_id = player.get("proTeamId")
    week = _current_week(coordinator)
    if not pro_team_id or week is None:
        return None

    for team in coordinator.data.get("pro_team_schedules", []):
        if int(team.get("id", -1)) != int(pro_team_id):
            continue
        game = (team.get("proGamesByScoringPeriod") or {}).get(str(week), [])
        if isinstance(game, dict):
            game = [game]
        if not game:
            return None
        game = game[0]
        opponent_id = game.get("opponentProTeamId") or game.get("opponentId")
        for key in ("awayProTeamId", "homeProTeamId"):
            value = game.get(key)
            if value is not None and int(value) != int(pro_team_id):
                opponent_id = value
        if opponent_id is None:
            return None
        return PRO_TEAM_NAMES.get(int(opponent_id), str(opponent_id))
    return None


class ESPNBaseSensor(CoordinatorEntity[ESPNDataUpdateCoordinator], SensorEntity):
    _attr_has_entity_name = True

    def __init__(self, coordinator: ESPNDataUpdateCoordinator, key: str, name: str) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.entry_id}_{key}"
        self._attr_name = name
        self._attr_device_info = {
            "identifiers": {(DOMAIN, coordinator.entry.entry_id)},
            "name": f"ESPN Fantasy {coordinator.entry.data[CONF_LEAGUE_ID]}",
            "manufacturer": "ESPN",
            "model": "Fantasy Football",
        }


class LeagueSensor(ESPNBaseSensor):
    def __init__(self, coordinator):
        super().__init__(coordinator, "league", "League")

    @property
    def native_value(self):
        return self.coordinator.data.get("settings", {}).get("name") or self.coordinator.data.get("name", "ESPN Fantasy")

    @property
    def extra_state_attributes(self):
        data = self.coordinator.data
        settings = data.get("settings", {})
        return {
            "league_id": self.coordinator.entry.data[CONF_LEAGUE_ID],
            "season": self.coordinator.entry.data[CONF_SEASON],
            "team_count": len(data.get("teams", [])),
            "current_week": data.get("status", {}).get("currentMatchupPeriod"),
            "scoring_type": settings.get("scoringSettings", {}).get("scoringType"),
        }


class TeamSensor(ESPNBaseSensor):
    def __init__(self, coordinator):
        super().__init__(coordinator, "team", "My Team")

    @property
    def native_value(self):
        team = _team(self.coordinator) or {}
        return team.get("name") or team.get("location") or "Unknown"

    @property
    def extra_state_attributes(self):
        team = _team(self.coordinator) or {}
        rec = _record(team)
        return {
            "team_id": team.get("id"), "abbrev": team.get("abbrev"),
            "location": team.get("location"), "nickname": team.get("nickname"),
            "wins": rec["wins"], "losses": rec["losses"], "ties": rec["ties"],
            "points_for": team.get("pointsFor"), "points_against": team.get("pointsAgainst"),
            "standing": team.get("playoffSeed") or team.get("rankFinal"),
            "division_id": team.get("divisionId"),
        }


class RecordSensor(ESPNBaseSensor):
    def __init__(self, coordinator):
        super().__init__(coordinator, "record", "Record")

    @property
    def native_value(self):
        rec = _record(_team(self.coordinator) or {})
        return f"{rec['wins']}-{rec['losses']}-{rec['ties']}"

    @property
    def extra_state_attributes(self):
        return _record(_team(self.coordinator) or {})


class PointsForSensor(ESPNBaseSensor):
    _attr_native_unit_of_measurement = "points"

    def __init__(self, coordinator):
        super().__init__(coordinator, "points_for", "Points For")

    @property
    def native_value(self):
        return (_team(self.coordinator) or {}).get("pointsFor", 0)


class PointsAgainstSensor(ESPNBaseSensor):
    _attr_native_unit_of_measurement = "points"

    def __init__(self, coordinator):
        super().__init__(coordinator, "points_against", "Points Against")

    @property
    def native_value(self):
        return (_team(self.coordinator) or {}).get("pointsAgainst", 0)


class CurrentWeekSensor(ESPNBaseSensor):
    def __init__(self, coordinator):
        super().__init__(coordinator, "current_week", "Current Week")

    @property
    def native_value(self):
        return _current_week(self.coordinator)


class RosterSensor(ESPNBaseSensor):
    def __init__(self, coordinator):
        super().__init__(coordinator, "roster", "Roster")

    @property
    def native_value(self):
        roster = (_team(self.coordinator) or {}).get("roster", {}).get("entries", [])
        return len(roster)

    @property
    def extra_state_attributes(self):
        entries = (_team(self.coordinator) or {}).get("roster", {}).get("entries", [])
        players = []
        for entry in entries:
            p = entry.get("playerPoolEntry", {}).get("player", {})
            players.append({
                "id": p.get("id"), "name": p.get("fullName"),
                "position": POSITION_NAMES.get(p.get("defaultPositionId"), p.get("defaultPositionId")),
                "lineup_slot": LINEUP_SLOT_NAMES.get(entry.get("lineupSlotId"), entry.get("lineupSlotId")),
            })
        return {"players": players}


class PlayerSensor(ESPNBaseSensor):
    _attr_native_unit_of_measurement = "points"

    def __init__(self, coordinator, entry: dict[str, Any], player: dict[str, Any]):
        pid = player.get("id") or entry.get("playerPoolEntry", {}).get("id")
        name = player.get("fullName") or f"Player {pid}"
        super().__init__(coordinator, f"player_{pid}", name)
        self.player_id = int(pid)
        self._attr_entity_picture = f"https://a.espncdn.com/i/headshots/nfl/players/full/{pid}.png"

    @property
    def _entry(self) -> dict[str, Any]:
        return _find_roster_entry(self.coordinator, self.player_id)

    @property
    def _player(self) -> dict[str, Any]:
        return self._entry.get("playerPoolEntry", {}).get("player", {})

    @property
    def _actual(self) -> dict[str, Any]:
        return _stat_entry(self._player, _current_week(self.coordinator), 0)

    @property
    def _projected(self) -> dict[str, Any]:
        return _stat_entry(self._player, _current_week(self.coordinator), 1)

    @property
    def _live(self) -> dict[str, Any] | None:
        return _find_live_player(self.coordinator.data.get("live_scoring", {}), self.player_id)

    @property
    def native_value(self):
        live = self._live or {}
        for key in ("liveAppliedStatTotal", "appliedStatTotal", "livePoints", "points"):
            if live.get(key) is not None:
                return live[key]
        return self._actual.get("appliedTotal", 0)

    @property
    def extra_state_attributes(self):
        player = self._player
        entry = self._entry
        actual = self._actual
        projected = self._projected
        season_actual = _season_stat_entry(player, 0)
        season_projected = _season_stat_entry(player, 1)
        live = self._live or {}
        actual_points = actual.get("appliedTotal")
        projected_points = projected.get("appliedTotal", projected.get("projectedTotal"))
        live_points = next((live.get(k) for k in ("liveAppliedStatTotal", "appliedStatTotal", "livePoints", "points") if live.get(k) is not None), None)
        ownership = player.get("ownership", {}) or {}
        ratings = entry.get("playerPoolEntry", {}).get("ratings", {}) or {}
        rating = next(iter(ratings.values()), {}) if isinstance(ratings, dict) else {}
        attrs = {
            "player_id": self.player_id,
            "position": POSITION_NAMES.get(player.get("defaultPositionId"), player.get("defaultPositionId")),
            "roster_slot": LINEUP_SLOT_NAMES.get(entry.get("lineupSlotId"), entry.get("lineupSlotId")),
            "eligible_slots": [LINEUP_SLOT_NAMES.get(slot, slot) for slot in player.get("eligibleSlots", [])],
            "nfl_team": PRO_TEAM_NAMES.get(player.get("proTeamId"), player.get("proTeamId")),
            "pro_team_id": player.get("proTeamId"),
            "opponent": _opponent(self.coordinator, player),
            "player_status": entry.get("status") or player.get("status"),
            "injury_status": player.get("injuryStatus"),
            "injured": player.get("injured"),
            "active": player.get("active"),
            "live_points": live_points,
            "actual_points": actual_points,
            "projected_points": projected_points,
            "points_vs_projection": (live_points if live_points is not None else actual_points) - projected_points if isinstance((live_points if live_points is not None else actual_points), (int, float)) and isinstance(projected_points, (int, float)) else None,
            "season_points": season_actual.get("appliedTotal"),
            "season_average": season_actual.get("appliedAverage"),
            "projected_season_points": season_projected.get("appliedTotal", season_projected.get("projectedTotal")),
            "projected_season_average": season_projected.get("appliedAverage"),
            "percent_owned": ownership.get("percentOwned"),
            "percent_started": ownership.get("percentStarted"),
            "position_rank": rating.get("positionalRanking"),
            "overall_rank": rating.get("totalRanking"),
            "total_rating": rating.get("totalRating"),
            "lineup_locked": entry.get("lineupLocked"),
            "acquisition_type": entry.get("acquisitionType"),
            "acquisition_date": entry.get("acquisitionDate"),
            "current_week": _current_week(self.coordinator),
            "headshot": self._attr_entity_picture,
        }
        attrs.update(_decode_stats(actual))
        return attrs


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ESPNDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[SensorEntity] = [
        LeagueSensor(coordinator), TeamSensor(coordinator), RecordSensor(coordinator),
        PointsForSensor(coordinator), PointsAgainstSensor(coordinator),
        CurrentWeekSensor(coordinator), RosterSensor(coordinator),
    ]

    team = _team(coordinator) or {}
    roster = team.get("roster", {}).get("entries", [])
    for roster_entry in roster:
        player = roster_entry.get("playerPoolEntry", {}).get("player", {})
        if player.get("id"):
            entities.append(PlayerSensor(coordinator, roster_entry, player))

    async_add_entities(entities)
