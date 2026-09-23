from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import HomeAssistant
from homeassistant.components.http import StaticPathConfig

from .const import PLATFORMS
from .coordinator import ESPNDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)

_CARD_FILENAME = "espn-fantasy-cards.js"
_CARD_PATH = Path(__file__).parent / "www" / _CARD_FILENAME
_CARD_STATIC_URL = f"/espn_fantasy/{_CARD_FILENAME}"
_CARD_URL = f"{_CARD_STATIC_URL}?v=0.1.9"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coordinator = ESPNDataUpdateCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    hass.data.setdefault("espn_fantasy", {})[entry.entry_id] = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    hass.async_create_task(_async_register_frontend(hass))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data["espn_fantasy"].pop(entry.entry_id, None)
    return unloaded


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve and register the bundled ESPN Fantasy Lovelace cards."""
    done_key = "espn_fantasy_frontend_registered"
    task_key = "espn_fantasy_frontend_task"

    if hass.data.get(done_key):
        return
    existing_task = hass.data.get(task_key)
    if existing_task and not existing_task.done():
        return

    async def _register_with_retries() -> None:
        for _ in range(60):
            try:
                if not _CARD_PATH.exists():
                    _LOGGER.warning("ESPN Fantasy card file not found: %s", _CARD_PATH)
                    return

                static_key = "espn_fantasy_static_registered"
                if not hass.data.get(static_key):
                    await hass.http.async_register_static_paths(
                        [
                            StaticPathConfig(
                                _CARD_STATIC_URL,
                                str(_CARD_PATH),
                                cache_headers=True,
                            )
                        ]
                    )
                    hass.data[static_key] = True

                lovelace_data = hass.data.get(LOVELACE_DATA)
                if lovelace_data is None:
                    await asyncio.sleep(2)
                    continue

                resources = getattr(lovelace_data, "resources", None)
                if resources is None:
                    await asyncio.sleep(2)
                    continue

                if hasattr(resources, "loaded") and not resources.loaded:
                    await resources.async_load()

                existing_urls = {
                    item["url"] for item in resources.async_items() if item.get("url")
                }
                if _CARD_URL not in existing_urls:
                    await resources.async_create_item(
                        {"res_type": "module", "url": _CARD_URL}
                    )
                    _LOGGER.info("Registered ESPN Fantasy Lovelace cards: %s", _CARD_URL)
                else:
                    _LOGGER.debug("ESPN Fantasy Lovelace cards already registered")

                hass.data[done_key] = True
                return
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("Waiting to register ESPN Fantasy cards: %s", err)
                await asyncio.sleep(2)

        _LOGGER.warning(
            "Could not automatically register ESPN Fantasy Lovelace cards. "
            "Add %s as a module resource if needed.",
            _CARD_URL,
        )

    task = hass.async_create_task(_register_with_retries())
    hass.data[task_key] = task

    def _clear_task(_future: asyncio.Future) -> None:
        hass.data.pop(task_key, None)

    task.add_done_callback(_clear_task)
    hass.bus.async_listen_once(
        EVENT_HOMEASSISTANT_STARTED,
        lambda _event: hass.async_create_task(_register_with_retries()),
    )
