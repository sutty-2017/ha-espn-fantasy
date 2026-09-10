from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_LEAGUE_ID, CONF_SEASON, CONF_TEAM_ID, DOMAIN
from .coordinator import ESPNDataUpdateCoordinator


def _team(coordinator: ESPNDataUpdateCoordinator) -> dict[str, Any] | None:
    team_id = int(coordinator.entry.data[CONF_TEAM_ID])
    return next((t for t in coordinator.data.get("teams", []) if int(t.get("id", -1)) == team_id), None)


def _record(team: dict[str, Any]) -> dict[str, int]:
    record = team.get("record", {})
    overall = record.get("overall", record)
    return {
        "wins": int(overall.get("wins", 0)),
        "losses": int(overall.get("losses", 0)),
        "ties": int(overall.get("ties", 0)),
    }


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
            "team_id": team.get("id"),
            "abbrev": team.get("abbrev"),
            "location": team.get("location"),
            "nickname": team.get("nickname"),
            "wins": rec["wins"],
            "losses": rec["losses"],
            "ties": rec["ties"],
            "points_for": team.get("pointsFor"),
            "points_against": team.get("pointsAgainst"),
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
        return self.coordinator.data.get("status", {}).get("currentMatchupPeriod")


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
                "id": p.get("id"),
                "name": p.get("fullName"),
                "position": p.get("defaultPositionId"),
                "lineup_slot": entry.get("lineupSlotId"),
                "points": p.get("stats", [{}])[-1].get("appliedTotal") if p.get("stats") else None,
            })
        return {"players": players}


class PlayerSensor(ESPNBaseSensor):
    def __init__(self, coordinator, entry: dict[str, Any], player: dict[str, Any]):
        pid = player.get("id") or entry.get("playerPoolEntry", {}).get("id")
        name = player.get("fullName") or f"Player {pid}"
        super().__init__(coordinator, f"player_{pid}", name)
        self.player_id = pid
        self.entry = entry

    @property
    def native_value(self):
        player = self.entry.get("playerPoolEntry", {}).get("player", {})
        stats = player.get("stats") or []
        return stats[-1].get("appliedTotal", 0) if stats else 0

    @property
    def extra_state_attributes(self):
        player = self.entry.get("playerPoolEntry", {}).get("player", {})
        stats = player.get("stats") or []
        latest = stats[-1] if stats else {}
        return {
            "player_id": self.player_id,
            "position": player.get("defaultPositionId"),
            "pro_team_id": player.get("proTeamId"),
            "injury_status": player.get("injuryStatus"),
            "percent_owned": player.get("ownership", {}).get("percentOwned"),
            "projected_points": latest.get("projectedTotal"),
            "actual_points": latest.get("appliedTotal"),
        }


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ESPNDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[SensorEntity] = [
        LeagueSensor(coordinator),
        TeamSensor(coordinator),
        RecordSensor(coordinator),
        PointsForSensor(coordinator),
        PointsAgainstSensor(coordinator),
        CurrentWeekSensor(coordinator),
        RosterSensor(coordinator),
    ]

    team = _team(coordinator) or {}
    roster = team.get("roster", {}).get("entries", [])
    for roster_entry in roster:
        player = roster_entry.get("playerPoolEntry", {}).get("player", {})
        if player.get("id"):
            entities.append(PlayerSensor(coordinator, roster_entry, player))

    async_add_entities(entities)
