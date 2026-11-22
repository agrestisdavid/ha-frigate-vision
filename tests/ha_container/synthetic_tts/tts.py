"""Real HA TTS entities returning completely synthetic WAV tones."""

import math
import struct
import wave
from io import BytesIO

from homeassistant.components.tts import TextToSpeechEntity


async def async_setup_entry(hass, entry, async_add_entities):
    calls = hass.data["synthetic_tts_calls"] = []
    async_add_entities([SyntheticTTS(calls, 660), SyntheticTTS(calls, 720)])


class SyntheticTTS(TextToSpeechEntity):
    _attr_default_language = "de-DE"

    def __init__(self, calls, frequency):
        self._attr_supported_languages = ["de-DE"]
        self._attr_name = self._attr_unique_id = f"Synthetic {frequency}"
        self._frequency = frequency
        self._calls = calls

    async def async_get_tts_audio(self, message, language, options):
        self._calls.append((self.entity_id, message))
        if message == "fixture failure":
            return None, None
        # Intentionally not the requested sample rate: HA must normalize it.
        rate = 24000
        out = BytesIO()
        with wave.open(out, "wb") as wav:
            wav.setparams((1, 2, rate, 0, "NONE", "not compressed"))
            wav.writeframes(
                b"".join(
                    struct.pack(
                        "<h",
                        round(
                            10000 * math.sin(2 * math.pi * self._frequency * i / rate)
                        ),
                    )
                    for i in range(rate)
                )
            )
        return "wav", out.getvalue()
