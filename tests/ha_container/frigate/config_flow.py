"""Supply a real HA config entry pointed at the in-container Frigate fixture."""

from homeassistant.config_entries import ConfigFlow


class SyntheticFrigateFlow(ConfigFlow, domain="frigate"):
    async def async_step_user(self, user_input):
        return self.async_create_entry(title="Synthetic Frigate", data=user_input)
