from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import ESPNAuthError, ESPNClient, ESPNError
from .const import (
    CONF_ESPN_S2,
    CONF_LEAGUE_ID,
    CONF_SEASON,
    CONF_SWID,
    CONF_TEAM_ID,
    DOMAIN,
)


class ESPNConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle ESPN Fantasy setup."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            try:
                league_id = int(user_input[CONF_LEAGUE_ID])
                team_id = int(user_input[CONF_TEAM_ID])
                season = int(user_input[CONF_SEASON])
                client = ESPNClient(
                    async_get_clientsession(self.hass),
                    season=season,
                    league_id=league_id,
                    espn_s2=user_input.get(CONF_ESPN_S2) or None,
                    swid=user_input.get(CONF_SWID) or None,
                )
                data = await client.get_league()
                team_ids = {int(team.get("id")) for team in data.get("teams", []) if team.get("id") is not None}
                if team_id not in team_ids:
                    errors[CONF_TEAM_ID] = "team_not_found"
                else:
                    await self.async_set_unique_id(f"{season}-{league_id}-{team_id}")
                    self._abort_if_unique_id_configured()
                    return self.async_create_entry(
                        title=f"ESPN {league_id} / Team {team_id}",
                        data={
                            CONF_LEAGUE_ID: league_id,
                            CONF_TEAM_ID: team_id,
                            CONF_SEASON: season,
                            CONF_ESPN_S2: user_input.get(CONF_ESPN_S2, "").strip(),
                            CONF_SWID: user_input.get(CONF_SWID, "").strip(),
                        },
                    )
            except ESPNAuthError:
                errors["base"] = "auth"
            except ESPNError:
                errors["base"] = "cannot_connect"
            except (TypeError, ValueError):
                errors["base"] = "invalid_input"

        schema = vol.Schema(
            {
                vol.Required(CONF_LEAGUE_ID): vol.Coerce(int),
                vol.Required(CONF_TEAM_ID): vol.Coerce(int),
                vol.Required(CONF_SEASON): vol.Coerce(int),
                vol.Optional(CONF_ESPN_S2, default=""): str,
                vol.Optional(CONF_SWID, default=""): str,
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
