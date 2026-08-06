"""Config flow for Frigate Vision."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_API_KEY,
    CONF_ENDPOINT,
    CONF_FRIGATE_ENTRY_ID,
    CONF_GO2RTC_MODES,
    CONF_GO2RTC_URL,
    CONF_GO2RTC_URL_EXTERNAL,
    CONF_MAX_TOKENS,
    CONF_MODEL,
    CONF_TARGET_WIDTH,
    CONF_TIMEOUT,
    DEFAULT_GO2RTC_MODES,
    DEFAULT_MAX_TOKENS,
    DEFAULT_TARGET_WIDTH,
    DEFAULT_TIMEOUT,
    DOMAIN,
    FRIGATE_DOMAIN,
)
from .utils import (
    normalize_chat_completions_url,
    sanitize_go2rtc_modes,
    validate_go2rtc_url,
)


def _text(password: bool = False, multiline: bool = False) -> selector.TextSelector:
    return selector.TextSelector(
        selector.TextSelectorConfig(
            type=(
                selector.TextSelectorType.PASSWORD
                if password
                else selector.TextSelectorType.TEXT
            ),
            multiline=multiline,
        )
    )


def _number(
    minimum: int, maximum: int, step: int, unit: str | None = None
) -> selector.NumberSelector:
    config: selector.NumberSelectorConfig = {
        "min": minimum,
        "max": maximum,
        "step": step,
        "mode": selector.NumberSelectorMode.BOX,
    }
    if unit is not None:
        config["unit_of_measurement"] = unit
    return selector.NumberSelector(config)


def _frigate_schema(entries: list[config_entries.ConfigEntry]) -> vol.Schema:
    """Build a portable dropdown for the available Frigate entries."""
    options: list[selector.SelectOptionDict] = [
        {"value": entry.entry_id, "label": entry.title or entry.entry_id}
        for entry in entries
    ]
    marker: vol.Marker
    if len(entries) == 1:
        marker = vol.Required(
            CONF_FRIGATE_ENTRY_ID,
            default=entries[0].entry_id,
        )
    else:
        marker = vol.Required(CONF_FRIGATE_ENTRY_ID)
    return vol.Schema(
        {
            marker: selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=options,
                    mode=selector.SelectSelectorMode.DROPDOWN,
                )
            )
        }
    )


def _provider_schema(defaults: dict[str, Any]) -> vol.Schema:
    """Build the provider and analysis settings form."""
    return vol.Schema(
        {
            vol.Required(
                CONF_ENDPOINT, default=defaults.get(CONF_ENDPOINT, "")
            ): _text(),
            vol.Optional(CONF_API_KEY, default=defaults.get(CONF_API_KEY, "")): _text(
                password=True
            ),
            vol.Required(CONF_MODEL, default=defaults.get(CONF_MODEL, "")): _text(),
            vol.Required(
                CONF_TIMEOUT,
                default=defaults.get(CONF_TIMEOUT, DEFAULT_TIMEOUT),
            ): _number(5, 300, 1, "s"),
            vol.Required(
                CONF_TARGET_WIDTH,
                default=defaults.get(CONF_TARGET_WIDTH, DEFAULT_TARGET_WIDTH),
            ): _number(320, 4096, 16, "px"),
            vol.Required(
                CONF_MAX_TOKENS,
                default=defaults.get(CONF_MAX_TOKENS, DEFAULT_MAX_TOKENS),
            ): _number(32, 8192, 1),
            vol.Optional(
                CONF_GO2RTC_URL,
                default=defaults.get(CONF_GO2RTC_URL, ""),
            ): _text(),
            vol.Optional(
                CONF_GO2RTC_URL_EXTERNAL,
                default=defaults.get(CONF_GO2RTC_URL_EXTERNAL, ""),
            ): _text(),
            vol.Optional(
                CONF_GO2RTC_MODES,
                default=defaults.get(CONF_GO2RTC_MODES, DEFAULT_GO2RTC_MODES),
            ): _text(),
        }
    )


def _validate_input(data: dict[str, Any]) -> dict[str, str]:
    errors: dict[str, str] = {}
    try:
        normalize_chat_completions_url(str(data.get(CONF_ENDPOINT, "")))
    except ValueError:
        errors[CONF_ENDPOINT] = "invalid_endpoint"
    if not str(data.get(CONF_MODEL, "")).strip():
        errors[CONF_MODEL] = "model_required"
    for key in (CONF_GO2RTC_URL, CONF_GO2RTC_URL_EXTERNAL):
        value = str(data.get(key, "")).strip()
        if value:
            try:
                validate_go2rtc_url(value)
            except ValueError:
                errors[key] = "invalid_endpoint"
    return errors


def _normalize_input(data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(data)
    for key in (
        CONF_ENDPOINT,
        CONF_API_KEY,
        CONF_MODEL,
    ):
        if key in normalized:
            normalized[key] = str(normalized[key]).strip()
    for key in (CONF_GO2RTC_URL, CONF_GO2RTC_URL_EXTERNAL):
        if key in normalized:
            value = str(normalized[key]).strip()
            normalized[key] = validate_go2rtc_url(value) if value else ""
    normalized[CONF_GO2RTC_MODES] = sanitize_go2rtc_modes(
        str(normalized.get(CONF_GO2RTC_MODES, ""))
    )
    normalized[CONF_TIMEOUT] = int(normalized[CONF_TIMEOUT])
    normalized[CONF_TARGET_WIDTH] = int(normalized[CONF_TARGET_WIDTH])
    normalized[CONF_MAX_TOKENS] = int(normalized[CONF_MAX_TOKENS])
    return normalized


class FrigateVisionConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Configure Frigate Vision."""

    VERSION = 1
    _frigate_entry_id: str | None = None

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        entries = self.hass.config_entries.async_entries(FRIGATE_DOMAIN)
        if not entries:
            return self.async_abort(reason="frigate_required")

        errors: dict[str, str] = {}
        if user_input is not None:
            frigate_entry_id = str(user_input.get(CONF_FRIGATE_ENTRY_ID, ""))
            frigate_entry = self.hass.config_entries.async_get_entry(frigate_entry_id)
            if not frigate_entry or frigate_entry.domain != FRIGATE_DOMAIN:
                errors[CONF_FRIGATE_ENTRY_ID] = "frigate_required"
            else:
                self._frigate_entry_id = frigate_entry_id
                await self.async_set_unique_id(frigate_entry_id)
                self._abort_if_unique_id_configured()
                return await self.async_step_provider()

        return self.async_show_form(
            step_id="user",
            data_schema=_frigate_schema(entries),
            errors=errors,
        )

    async def async_step_provider(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Configure the provider after selecting a Frigate instance."""
        frigate_entry_id = self._frigate_entry_id
        if not frigate_entry_id:
            return await self.async_step_user()

        frigate_entry = self.hass.config_entries.async_get_entry(frigate_entry_id)
        if not frigate_entry or frigate_entry.domain != FRIGATE_DOMAIN:
            return self.async_abort(reason="frigate_required")

        errors: dict[str, str] = {}
        if user_input is not None:
            errors = _validate_input(user_input)
            if not errors:
                await self.async_set_unique_id(frigate_entry_id)
                self._abort_if_unique_id_configured()
                data = _normalize_input(user_input)
                data[CONF_FRIGATE_ENTRY_ID] = frigate_entry_id
                return self.async_create_entry(
                    title=f"Frigate Vision – {frigate_entry.title}",
                    data=data,
                )

        return self.async_show_form(
            step_id="provider",
            data_schema=_provider_schema(user_input or {}),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> FrigateVisionOptionsFlow:
        return FrigateVisionOptionsFlow(config_entry)


class FrigateVisionOptionsFlow(config_entries.OptionsFlow):
    """Update provider and analysis settings."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self._config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        errors: dict[str, str] = {}
        defaults = {**self._config_entry.data, **self._config_entry.options}
        if user_input is not None:
            errors = _validate_input(user_input)
            if not errors:
                return self.async_create_entry(
                    title="", data=_normalize_input(user_input)
                )
            defaults = user_input
        return self.async_show_form(
            step_id="init",
            data_schema=_provider_schema(defaults),
            errors=errors,
        )
