"""Synthetic audio fixtures on the disposable HA container's isolated network."""

import asyncio
import json
import math
import socket
from pathlib import Path

from aiohttp import WSMsgType, web
from homeassistant.auth.const import GROUP_ID_READ_ONLY
from homeassistant.helpers.http import HomeAssistantView

STREAM = "fixture_b"
SPEAKER = Path("/config/synthetic-speaker.alaw")


def speaker_measurement():
    """Report only level at each test frequency, measured at the simulated speaker."""
    try:
        with SPEAKER.open("rb") as f:
            size = f.seek(0, 2)
            f.seek(max(0, size - 1600))  # at most 200 ms of G.711 A-law at 8 kHz
            tail = f.read(1600)
    except FileNotFoundError:
        size, tail = 0, b""
    samples = []
    for byte in tail:
        a = byte ^ 0x55
        exponent = (a >> 4) & 7
        magnitude = ((a & 15) << 4) + 8 + (256 if exponent else 0)
        value = (magnitude << max(0, exponent - 1)) / 32768
        samples.append(value if a & 128 else -value)

    def level(hz):
        if len(samples) < 800:
            return 0
        step = 2 * math.pi * hz / 8000
        return round(
            2
            * math.hypot(
                sum(x * math.cos(i * step) for i, x in enumerate(samples)),
                sum(x * math.sin(i * step) for i, x in enumerate(samples)),
            )
            / len(samples),
            5,
        )

    return {"samples": size, "mic880": level(880), "camera440": level(440)}


class SpeakerView(HomeAssistantView):
    url = "/api/fv_audio_test/speaker"
    name = "api:fv_audio_test:speaker"

    async def get(self, request):
        return web.json_response(await asyncio.to_thread(speaker_measurement))


class FrigateProxyFixture(HomeAssistantView):
    """Stand in for Frigate's authenticated socket route, not for go2rtc or ICE."""

    url = "/api/frigate/smoke/go2rtc/ws/api/ws"
    name = "api:fv_audio_test:frigate"

    def __init__(self, session):
        self.session = session

    async def get(self, request):
        if request.query.get("src") != STREAM:
            raise web.HTTPNotFound()
        async with self.session.ws_connect(
            f"http://127.0.0.1:1984/api/ws?src={STREAM}"
        ) as upstream:
            client = web.WebSocketResponse()
            await client.prepare(request)

            async def forward(source, target):
                async for msg in source:
                    if msg.type == WSMsgType.TEXT:
                        await target.send_str(msg.data)

            pumps = [
                asyncio.create_task(forward(a, b))
                for a, b in ((client, upstream), (upstream, client))
            ]
            try:
                await asyncio.wait(pumps, return_when=asyncio.FIRST_COMPLETED)
            finally:
                for pump in pumps:
                    pump.cancel()
                await asyncio.gather(*pumps, return_exceptions=True)
                await client.close()
        return client


async def serve(hass, session, module_url):
    """Run HA and real go2rtc until the external test browser exits."""
    hass.http.register_view(FrigateProxyFixture(session))
    hass.http.register_view(SpeakerView())
    # Docker's isolated bridge deliberately has no default route. Advertise its
    # actual interface rather than relying on go2rtc's default-route discovery.
    address = await asyncio.to_thread(socket.gethostbyname, socket.gethostname())
    candidates = json.dumps({"webrtc": {"candidates": [f"{address}:8555"]}})
    process = await asyncio.create_subprocess_exec(
        "go2rtc", "-c", "/smoke/audio/go2rtc.yaml", "-c", candidates
    )
    try:
        user = await hass.auth.async_create_system_user(
            "Synthetic audio viewer", group_ids=[GROUP_ID_READ_ONLY]
        )
        refresh = await hass.auth.async_create_refresh_token(user)
        # The host runner passes this one-run token over stdin, never a CLI arg,
        # HTTP bootstrap endpoint, log or host file. /config is a fresh tmpfs.
        settings = json.dumps(
            {
                "token": hass.auth.async_create_access_token(refresh),
                "module": module_url,
            }
        )
        marker = Path("/config/audio-test.json")
        marker.with_suffix(".tmp").write_text(settings)
        marker.with_suffix(".tmp").replace(marker)
        await process.wait()
        raise RuntimeError("go2rtc stopped before the audio scenario was torn down")
    finally:
        if process.returncode is None:
            process.terminate()
            await process.wait()
