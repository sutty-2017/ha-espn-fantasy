from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_LEAGUE_ID, CONF_TEAM_ID, DOMAIN
from .coordinator import ESPNDataUpdateCoordinator
from .sensor import POSITION_NAMES, PRO_TEAM_NAMES, _current_week, _find_live_player, _find_roster_entry, _opponent

PARALLEL_UPDATES = 0


class PlayerGameActiveSensor(CoordinatorEntity[ESPNDataUpdateCoordinator], BinarySensorEntity):
    """Binary sensor that is on while ESPN reports a player's NFL game live."""

    _attr_has_entity_name = True
    _attr_device_class = "running"

    def __init__(self, coordinator: ESPNDataUpdateCoordinator, player: dict[str, Any]) -> None:
        super().__init__(coordinator)
        self.player_id = int(player.get("id"))
        self._player_name = player.get("fullName") or f"Player {self.player_id}"
        self._attr_unique_id = f"{coordinator.entry.entry_id}_player_{self.player_id}_game_active"
        self._attr_name = f"{self._player_name} Game Active"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, coordinator.entry.entry_id)},
            "name": f"ESPN Fantasy {coordinator.entry.data[CONF_LEAGUE_ID]}",
            "manufacturer": "ESPN",
            "model": "Fantasy Football",
        }

    @property
    def _entry(self) -> dict[str, Any]:
        return _find_roster_entry(self.coordinator, self.player_id)

    @property
    def _player(self) -> dict[str, Any]:
        return self._entry.get("playerPoolEntry", {}).get("player", {})

    @property
    def _live(self) -> dict[str, Any] | None:
        return _find_live_player(self.coordinator.data.get("live_scoring", {}), self.player_id)

    @property
    def is_on(self) -> bool:
        return self._live is not None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        player = self._player
        entry = self._entry
        live = self._live or {}
        return {
            "player_id": self.player_id,
            "position": POSITION_NAMES.get(player.get("defaultPositionId"), player.get("defaultPositionId")),
            "nfl_team": PRO_TEAM_NAMES.get(player.get("proTeamId"), player.get("proTeamId")),
            "opponent": _opponent(self.coordinator, player),
            "current_week": _current_week(self.coordinator),
            "roster_slot": entry.get("lineupSlotId"),
            "live_points": next(
                (live.get(key) for key in ("liveAppliedStatTotal", "appliedStatTotal", "livePoints", "points") if live.get(key) is not None),
                None,
            ),
        }


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities,
) -> None:
    coordinator: ESPNDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]
    team = next(
        (
            team
            for team in coordinator.data.get("teams", [])
            if int(team.get("id", -1)) == int(entry.data[CONF_TEAM_ID])
        ),
        {},
    )
    roster = team.get("roster", {}).get("entries", [])
    players = [
        roster_entry.get("playerPoolEntry", {}).get("player", {})
        for roster_entry in roster
        if roster_entry.get("playerPoolEntry", {}).get("player", {}).get("id")
    ]
    async_add_entities([PlayerGameActiveSensor(coordinator, player) for player in players])
