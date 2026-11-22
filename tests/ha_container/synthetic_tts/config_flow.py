"""Configure the disposable TTS fixture."""

from homeassistant import config_entries


class SyntheticTTSFlow(config_entries.ConfigFlow, domain="synthetic_tts"):
    async def async_step_user(self, user_input=None):
        return self.async_create_entry(title="Synthetic TTS", data={})
