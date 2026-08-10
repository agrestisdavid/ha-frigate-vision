"""Behavior tests for event readiness and event-scoped single-flight."""

from __future__ import annotations

import asyncio
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
COMPONENT = ROOT / "custom_components" / "frigate_vision"


def _module(name: str, **attributes):
    module = types.ModuleType(name)
    module.__dict__.update(attributes)
    sys.modules[name] = module
    return module


def load_analysis():
    """Load analysis.py with small dependency stubs instead of Home Assistant."""
    package_name = "frigate_vision_event_test"
    package = _module(package_name)
    package.__path__ = [str(COMPONENT)]

    const_spec = importlib.util.spec_from_file_location(
        f"{package_name}.const",
        COMPONENT / "const.py",
    )
    const_module = importlib.util.module_from_spec(const_spec)
    sys.modules[const_spec.name] = const_module
    const_spec.loader.exec_module(const_module)

    utils_spec = importlib.util.spec_from_file_location(
        f"{package_name}.utils",
        COMPONENT / "utils.py",
    )
    utils_module = importlib.util.module_from_spec(utils_spec)
    sys.modules[utils_spec.name] = utils_module
    utils_spec.loader.exec_module(utils_module)

    class ClientError(Exception):
        pass

    class ClientResponseError(ClientError):
        def __init__(self, status: int) -> None:
            super().__init__(str(status))
            self.status = status

    class ClientTimeout:
        def __init__(self, total: float) -> None:
            self.total = total

    _module(
        "aiohttp",
        ClientError=ClientError,
        ClientResponse=object,
        ClientResponseError=ClientResponseError,
        ClientTimeout=ClientTimeout,
    )

    homeassistant = _module("homeassistant")
    homeassistant.__path__ = []
    components = _module("homeassistant.components")
    components.__path__ = []
    media_source = _module(
        "homeassistant.components.media_source",
        is_media_source_id=lambda _value: True,
        async_resolve_media=None,
    )
    components.media_source = media_source
    _module("homeassistant.components.camera", async_get_image=None)
    _module("homeassistant.components.image", async_get_image=None)
    media_player = _module("homeassistant.components.media_player")
    media_player.__path__ = []
    _module(
        "homeassistant.components.media_player.browse_media",
        async_process_play_media_url=lambda value: value,
    )
    _module("homeassistant.config_entries", ConfigEntry=object)
    _module("homeassistant.const", CONF_URL="url")
    _module("homeassistant.core", HomeAssistant=object)
    helpers = _module("homeassistant.helpers")
    helpers.__path__ = []
    _module(
        "homeassistant.helpers.aiohttp_client",
        async_get_clientsession=lambda _hass: None,
    )

    class UnidentifiedImageError(Exception):
        pass

    class FakeImage:
        def __init__(self, width: int, height: int) -> None:
            self.width = width
            self.height = height

        def __enter__(self):
            return self

        def __exit__(self, _exc_type, _exc, _traceback):
            return False

        def load(self) -> None:
            return None

        def convert(self, _mode: str):
            return self

        def resize(self, size, _resampling):
            return FakeImage(*size)

        def save(self, output, **_kwargs) -> None:
            output.write(f"fake:{self.width}x{self.height}".encode())

    class ImageStub:
        class DecompressionBombError(Exception):
            pass

        class Resampling:
            LANCZOS = 1

        @staticmethod
        def open(stream):
            value = stream.getvalue().decode(errors="ignore")
            if not value.startswith("fake:") or "x" not in value:
                raise UnidentifiedImageError
            width, height = value.removeprefix("fake:").split("x", 1)
            return FakeImage(int(width), int(height))

    _module("PIL", Image=ImageStub, UnidentifiedImageError=UnidentifiedImageError)

    class URL:
        def __init__(self, value: str) -> None:
            self.value = value

        def __truediv__(self, path: str):
            return URL(f"{self.value.rstrip('/')}/{path}")

        def __str__(self) -> str:
            return self.value

    _module("yarl", URL=URL)

    analysis_spec = importlib.util.spec_from_file_location(
        f"{package_name}.analysis",
        COMPONENT / "analysis.py",
    )
    analysis_module = importlib.util.module_from_spec(analysis_spec)
    sys.modules[analysis_spec.name] = analysis_module
    analysis_spec.loader.exec_module(analysis_module)
    return analysis_module


class FakeHass:
    def async_create_task(self, coroutine, name=None):
        return asyncio.create_task(coroutine, name=name)

    async def async_add_executor_job(self, target, *args):
        return target(*args)


class FakeEntry:
    def __init__(self) -> None:
        self.background_tasks = 0
        self.data = {"event_image_source": "event_snapshot"}
        self.options = {}

    def async_create_background_task(self, _hass, coroutine, name):
        self.background_tasks += 1
        return asyncio.create_task(coroutine, name=name)


class FakeProvider:
    def __init__(self, module, error=None, wait=False) -> None:
        self.module = module
        self.error = error
        self.wait = wait
        self.calls = 0
        self.started = asyncio.Event()
        self.release = asyncio.Event()

    async def analyze(self, _snapshot: bytes, _prompt: str) -> str:
        self.calls += 1
        self.started.set()
        if self.wait:
            await self.release.wait()
        if self.error is not None:
            raise self.error
        return "Eine Person geht zur Einfahrt."


class FakeFrigate:
    def __init__(
        self, event_outcomes, snapshot_outcomes, recording_outcomes=None
    ) -> None:
        self.event_outcomes = list(event_outcomes)
        self.snapshot_outcomes = list(snapshot_outcomes)
        self.event_calls = 0
        self.event_timeouts = []
        self.snapshot_calls = 0
        self.recording_calls = 0
        self.recording_requests = []
        self.recording_timeouts = []
        self.recording_outcomes = list(recording_outcomes or [b"recording-jpeg"])
        self.write_calls = 0
        self.descriptions = []

    @staticmethod
    def _next(outcomes):
        value = outcomes.pop(0) if len(outcomes) > 1 else outcomes[0]
        if isinstance(value, BaseException):
            raise value
        return value

    async def get_event(self, _event_id: str, *, timeout: float):
        self.event_calls += 1
        self.event_timeouts.append(timeout)
        return self._next(self.event_outcomes)

    async def get_snapshot(self, _event_id: str, *, timeout: float):
        self.snapshot_calls += 1
        return self._next(self.snapshot_outcomes)

    async def get_recording_snapshot(
        self, _event_id: str, camera: str, frame_time: float, *, timeout: float
    ):
        self.recording_calls += 1
        self.recording_requests.append((camera, frame_time))
        self.recording_timeouts.append(timeout)
        return self._next(self.recording_outcomes)

    async def set_description(self, _event_id: str, _description: str) -> None:
        self.write_calls += 1
        self.descriptions.append(_description)

    @staticmethod
    def key_frame_url(event_id: str, _camera_entity: str | None) -> str:
        return f"/snapshot/{event_id}.jpg"


class Clock:
    def __init__(self) -> None:
        self.value = 0.0

    def monotonic(self) -> float:
        return self.value

    async def sleep(self, delay: float) -> None:
        self.value += delay


class SequenceProvider:
    def __init__(self) -> None:
        self.calls = 0

    async def analyze(self, _snapshot: bytes, _prompt: str) -> str:
        self.calls += 1
        return f"description-{self.calls}"


class BlockingWriteFrigate(FakeFrigate):
    def __init__(self, event) -> None:
        super().__init__([event], [b"jpeg"])
        self.first_write_started = asyncio.Event()
        self.release_first_write = asyncio.Event()

    async def set_description(self, event_id: str, description: str) -> None:
        await super().set_description(event_id, description)
        if self.write_calls == 1:
            self.first_write_started.set()
            await self.release_first_write.wait()


ANALYSIS = load_analysis()


def jpeg(width: int = 640, height: int = 360) -> bytes:
    return f"fake:{width}x{height}".encode()


def jpeg_size(image_bytes: bytes) -> tuple[int, int]:
    width, height = image_bytes.decode().removeprefix("fake:").split("x", 1)
    return int(width), int(height)


class EventAnalysisTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.analysis = ANALYSIS
        cls.event_id = "example-event-id"

    def runtime(self, frigate, provider):
        return self.analysis.RuntimeData(
            hass=FakeHass(),
            entry=FakeEntry(),
            frigate_entry=None,
            provider=provider,
            frigate=frigate,
        )

    def recording_runtime(self, frigate, provider):
        runtime = self.runtime(frigate, provider)
        runtime.entry.data = {
            "event_image_source": "recording_preferred",
            "recording_wait_timeout": 20,
        }
        return runtime

    def test_event_frame_time_uses_strict_precedence(self) -> None:
        event = {
            "data": {"snapshot_frame_time": "12.5", "frame_time": 11},
            "start_time": 10,
        }
        self.assertEqual(self.analysis.event_frame_time(event), 12.5)
        event["data"]["snapshot_frame_time"] = float("nan")
        self.assertEqual(self.analysis.event_frame_time(event), 11)
        event["data"]["frame_time"] = True
        self.assertEqual(self.analysis.event_frame_time(event), 10)
        event["start_time"] = float("inf")
        self.assertIsNone(self.analysis.event_frame_time(event))

    def test_image_resize_never_upscales_and_preserves_panorama_ratio(self) -> None:
        small = self.analysis._prepare_jpeg(jpeg(640, 360), 1280)
        panorama = self.analysis._prepare_jpeg(jpeg(5120, 1552), 2048)
        self.assertEqual(jpeg_size(small), (640, 360))
        self.assertEqual(jpeg_size(panorama), (2048, 621))

    async def test_recording_snapshot_is_preferred_and_reported(self) -> None:
        event = {
            "id": self.event_id,
            "camera": "wide_driveway",
            "start_time": 100.0,
            "data": {"snapshot_frame_time": 105.25},
        }
        frigate = FakeFrigate([event], [b"detect"], [jpeg()])
        provider = FakeProvider(self.analysis)

        result = await self.analysis.analyze_event(
            self.recording_runtime(frigate, provider),
            event_id=self.event_id,
            camera_entity="camera.driveway",
            prompt="Describe.",
            store=False,
            force=False,
        )

        self.assertEqual(frigate.recording_requests, [("wide_driveway", 105.25)])
        self.assertEqual(frigate.snapshot_calls, 0)
        self.assertEqual(result["image_source"], "recording")
        self.assertEqual(result["source_frame_time"], 105.25)

    async def test_detect_snapshot_policy_skips_recording(self) -> None:
        event = {
            "id": self.event_id,
            "camera": "driveway",
            "start_time": 100.0,
            "data": {"frame_time": 101.5},
        }
        frigate = FakeFrigate([event], [jpeg()], [jpeg(3840, 2160)])

        result = await self.analysis.analyze_event(
            self.runtime(frigate, FakeProvider(self.analysis)),
            event_id=self.event_id,
            camera_entity=None,
            prompt="Describe.",
            store=False,
            force=False,
        )

        self.assertEqual(frigate.recording_calls, 0)
        self.assertEqual(frigate.snapshot_calls, 1)
        self.assertEqual(result["image_source"], "event_snapshot")
        self.assertEqual(result["source_frame_time"], 101.5)

    async def test_old_entry_without_new_options_uses_runtime_defaults(self) -> None:
        event = {
            "id": self.event_id,
            "camera": "driveway",
            "start_time": 100.0,
            "data": {},
        }
        frigate = FakeFrigate([event], [jpeg()], [jpeg(3840, 2160)])
        runtime = self.runtime(frigate, FakeProvider(self.analysis))
        runtime.entry.data = {}

        result = await self.analysis.analyze_event(
            runtime,
            event_id=self.event_id,
            camera_entity=None,
            prompt="Describe.",
            store=False,
            force=False,
        )

        self.assertEqual(result["image_source"], "recording")
        self.assertEqual(frigate.recording_calls, 1)

    async def test_missing_recording_metadata_uses_detect_fallback(self) -> None:
        event = {"id": self.event_id, "data": {}}
        frigate = FakeFrigate([event], [jpeg()])

        result = await self.analysis.analyze_event(
            self.recording_runtime(frigate, FakeProvider(self.analysis)),
            event_id=self.event_id,
            camera_entity=None,
            prompt="Describe.",
            store=False,
            force=False,
        )

        self.assertEqual(frigate.recording_calls, 0)
        self.assertEqual(frigate.snapshot_calls, 1)
        self.assertEqual(result["image_source"], "event_snapshot")
        self.assertIsNone(result["source_frame_time"])

    async def test_recording_auth_error_never_falls_back(self) -> None:
        unauthorized = self.analysis.FrigateEventError(
            "unauthorized", transient=False, status=401
        )
        event = {
            "id": self.event_id,
            "camera": "driveway",
            "start_time": 100.0,
            "data": {},
        }
        frigate = FakeFrigate([event], [jpeg()], [unauthorized])

        with self.assertRaises(self.analysis.FrigateEventError):
            await self.analysis.analyze_event(
                self.recording_runtime(frigate, FakeProvider(self.analysis)),
                event_id=self.event_id,
                camera_entity=None,
                prompt="Describe.",
                store=False,
                force=False,
            )

        self.assertEqual(frigate.snapshot_calls, 0)

    async def test_permanent_recording_source_error_still_uses_fallback(self) -> None:
        unsupported = self.analysis.FrigateEventError(
            "recording route unsupported",
            transient=False,
            status=400,
        )
        event = {
            "id": self.event_id,
            "camera": "driveway",
            "start_time": 100.0,
            "data": {},
        }
        frigate = FakeFrigate([event], [jpeg()], [unsupported])

        result = await self.analysis.analyze_event(
            self.recording_runtime(frigate, FakeProvider(self.analysis)),
            event_id=self.event_id,
            camera_entity=None,
            prompt="Describe.",
            store=False,
            force=False,
        )

        self.assertEqual(frigate.recording_calls, 1)
        self.assertEqual(frigate.snapshot_calls, 1)
        self.assertEqual(result["image_source"], "event_snapshot")

    async def test_zero_recording_wait_still_attempts_once_then_falls_back(
        self,
    ) -> None:
        transient = self.analysis.FrigateEventError(
            "not ready", transient=True, status=404
        )
        event = {
            "id": self.event_id,
            "camera": "driveway",
            "start_time": 100.0,
            "data": {},
        }
        frigate = FakeFrigate([event], [jpeg()], [transient])
        runtime = self.recording_runtime(frigate, FakeProvider(self.analysis))
        runtime.entry.data["recording_wait_timeout"] = 0

        result = await self.analysis.analyze_event(
            runtime,
            event_id=self.event_id,
            camera_entity=None,
            prompt="Describe.",
            store=False,
            force=False,
        )

        self.assertEqual(frigate.recording_calls, 1)
        self.assertEqual(frigate.snapshot_calls, 1)
        self.assertEqual(frigate.event_timeouts[0], 1.0)
        self.assertEqual(frigate.recording_timeouts[0], 1.0)
        self.assertEqual(result["image_source"], "event_snapshot")

    async def test_zero_recording_wait_can_use_an_immediately_available_frame(
        self,
    ) -> None:
        event = {
            "id": self.event_id,
            "camera": "driveway",
            "start_time": 100.0,
            "data": {},
        }
        frigate = FakeFrigate([event], [jpeg()], [jpeg(3840, 2160)])
        runtime = self.recording_runtime(frigate, FakeProvider(self.analysis))
        runtime.entry.data["recording_wait_timeout"] = 0

        result = await self.analysis.analyze_event(
            runtime,
            event_id=self.event_id,
            camera_entity=None,
            prompt="Describe.",
            store=False,
            force=False,
        )

        self.assertEqual(result["image_source"], "recording")
        self.assertEqual(frigate.snapshot_calls, 0)
        self.assertEqual(frigate.recording_timeouts, [1.0])

    async def test_recording_404_retries_for_full_window_before_detect_fallback(
        self,
    ) -> None:
        transient = self.analysis.FrigateEventError(
            "not ready",
            transient=True,
            status=404,
        )
        event = {
            "id": self.event_id,
            "camera": "driveway",
            "start_time": 100.0,
            "data": {},
        }
        frigate = FakeFrigate([event], [jpeg()], [transient])
        runtime = self.recording_runtime(frigate, FakeProvider(self.analysis))
        clock = Clock()

        with (
            patch.object(self.analysis, "monotonic", clock.monotonic),
            patch.object(self.analysis.asyncio, "sleep", clock.sleep),
        ):
            result = await self.analysis.analyze_event(
                runtime,
                event_id=self.event_id,
                camera_entity=None,
                prompt="Describe.",
                store=False,
                force=False,
            )

        self.assertEqual(clock.value, 20.0)
        self.assertGreater(frigate.recording_calls, 4)
        self.assertEqual(frigate.snapshot_calls, 1)
        self.assertEqual(result["image_source"], "event_snapshot")

    async def test_event_and_snapshot_404_retry_then_write_once(self) -> None:
        transient = self.analysis.FrigateEventError(
            "not ready",
            transient=True,
            status=404,
        )
        event = {"id": self.event_id, "data": {}}
        frigate = FakeFrigate(
            [transient, event, event],
            [transient, b"jpeg"],
        )
        provider = FakeProvider(self.analysis)
        runtime = self.runtime(frigate, provider)

        with patch.object(self.analysis, "EVENT_RETRY_DELAYS", (0, 0, 0, 0)):
            result = await self.analysis.analyze_event(
                runtime,
                event_id=self.event_id,
                camera_entity="camera.driveway",
                prompt="Describe the image.",
                store=True,
                force=False,
            )

        self.assertEqual(frigate.event_calls, 3)
        self.assertEqual(frigate.snapshot_calls, 2)
        self.assertEqual(provider.calls, 1)
        self.assertEqual(frigate.write_calls, 1)
        self.assertTrue(result["stored"])
        self.assertFalse(result["cached"])

    async def test_cache_is_rechecked_after_a_transient_event_error(self) -> None:
        transient = self.analysis.FrigateEventError("not ready", transient=True)
        event = {
            "id": self.event_id,
            "data": {"description": "Already described."},
        }
        frigate = FakeFrigate([transient, event], [b"unused"])
        provider = FakeProvider(self.analysis)

        with patch.object(self.analysis, "EVENT_RETRY_DELAYS", (0, 0, 0, 0)):
            result = await self.analysis.analyze_event(
                self.runtime(frigate, provider),
                event_id=self.event_id,
                camera_entity=None,
                prompt="Describe.",
                store=True,
                force=False,
            )

        self.assertEqual(frigate.event_calls, 2)
        self.assertEqual(frigate.snapshot_calls, 0)
        self.assertEqual(provider.calls, 0)
        self.assertEqual(frigate.write_calls, 0)
        self.assertTrue(result["cached"])
        self.assertIsNone(result["image_source"])

    async def test_permanently_missing_event_expires_without_provider(self) -> None:
        transient = self.analysis.FrigateEventError(
            "not ready",
            transient=True,
            status=404,
        )
        frigate = FakeFrigate([transient], [b"unused"])
        provider = FakeProvider(self.analysis)
        clock = Clock()

        with (
            patch.object(self.analysis, "monotonic", clock.monotonic),
            patch.object(self.analysis.asyncio, "sleep", clock.sleep),
            self.assertRaisesRegex(
                self.analysis.FrigateEventError,
                "innerhalb von 20 Sekunden",
            ),
        ):
            await self.analysis.analyze_event(
                self.runtime(frigate, provider),
                event_id=self.event_id,
                camera_entity=None,
                prompt="Describe.",
                store=True,
                force=False,
            )

        self.assertEqual(clock.value, 20.0)
        self.assertGreater(frigate.event_calls, 4)
        self.assertEqual(provider.calls, 0)
        self.assertEqual(frigate.write_calls, 0)

    async def test_permanent_source_error_stops_immediately(self) -> None:
        unauthorized = self.analysis.FrigateEventError(
            "unauthorized",
            transient=False,
            status=401,
        )
        frigate = FakeFrigate([unauthorized], [b"unused"])
        provider = FakeProvider(self.analysis)

        with self.assertRaises(self.analysis.FrigateEventError):
            await self.analysis.analyze_event(
                self.runtime(frigate, provider),
                event_id=self.event_id,
                camera_entity=None,
                prompt="Describe.",
                store=True,
                force=False,
            )

        self.assertEqual(frigate.event_calls, 1)
        self.assertEqual(provider.calls, 0)
        self.assertEqual(frigate.write_calls, 0)

    async def test_provider_errors_are_not_retried_or_written(self) -> None:
        for message in (
            "HTTP 401",
            "HTTP 500",
            "timeout",
            "empty response",
        ):
            with self.subTest(message=message):
                event = {"id": self.event_id, "data": {}}
                frigate = FakeFrigate([event], [b"jpeg"])
                provider = FakeProvider(
                    self.analysis,
                    error=self.analysis.ProviderError(message),
                )
                with self.assertRaises(self.analysis.ProviderError):
                    await self.analysis.analyze_event(
                        self.runtime(frigate, provider),
                        event_id=self.event_id,
                        camera_entity=None,
                        prompt="Describe.",
                        store=True,
                        force=False,
                    )
                self.assertEqual(provider.calls, 1)
                self.assertEqual(frigate.write_calls, 0)

    async def test_concurrent_calls_share_provider_and_write(self) -> None:
        event = {"id": self.event_id, "data": {}}
        frigate = FakeFrigate([event], [b"jpeg"])
        provider = FakeProvider(self.analysis, wait=True)
        runtime = self.runtime(frigate, provider)

        first = asyncio.create_task(
            self.analysis.analyze_event(
                runtime,
                event_id=self.event_id,
                camera_entity="camera.driveway",
                prompt="Describe.",
                store=False,
                force=False,
            )
        )
        await provider.started.wait()
        provider.release.set()
        second = asyncio.create_task(
            self.analysis.analyze_event(
                runtime,
                event_id=self.event_id,
                camera_entity="camera.driveway",
                prompt="Describe.",
                store=True,
                force=False,
            )
        )
        first_result, second_result = await asyncio.gather(first, second)

        self.assertEqual(provider.calls, 1)
        self.assertEqual(frigate.write_calls, 1)
        self.assertFalse(first_result["stored"])
        self.assertTrue(second_result["stored"])
        self.assertEqual(runtime.event_flights, {})
        self.assertEqual(runtime.event_write_flights, {})
        self.assertEqual(runtime.entry.background_tasks, 2)

    async def test_two_store_callers_share_one_description_write(self) -> None:
        event = {"id": self.event_id, "data": {}}
        frigate = FakeFrigate([event], [b"jpeg"])
        provider = FakeProvider(self.analysis, wait=True)
        runtime = self.runtime(frigate, provider)

        calls = [
            asyncio.create_task(
                self.analysis.analyze_event(
                    runtime,
                    event_id=self.event_id,
                    camera_entity=None,
                    prompt="Describe.",
                    store=True,
                    force=False,
                )
            )
            for _index in range(2)
        ]
        await provider.started.wait()
        provider.release.set()
        results = await asyncio.gather(*calls)

        self.assertEqual(provider.calls, 1)
        self.assertEqual(frigate.write_calls, 1)
        self.assertTrue(all(result["stored"] for result in results))

    async def test_forced_results_do_not_share_a_different_description_write(
        self,
    ) -> None:
        event = {"id": self.event_id, "data": {}}
        frigate = BlockingWriteFrigate(event)
        provider = SequenceProvider()
        runtime = self.runtime(frigate, provider)

        calls = [
            asyncio.create_task(
                self.analysis.analyze_event(
                    runtime,
                    event_id=self.event_id,
                    camera_entity=None,
                    prompt="Describe.",
                    store=True,
                    force=True,
                )
            )
            for _index in range(2)
        ]
        await frigate.first_write_started.wait()
        await asyncio.sleep(0)
        frigate.release_first_write.set()
        results = await asyncio.gather(*calls)

        self.assertEqual(provider.calls, 2)
        self.assertCountEqual(
            frigate.descriptions,
            ["description-1", "description-2"],
        )
        self.assertEqual(
            {result["response_text"] for result in results},
            {"description-1", "description-2"},
        )
        self.assertTrue(all(result["stored"] for result in results))


class FakeContent:
    def __init__(self, body: bytes) -> None:
        self.body = body

    async def iter_chunked(self, _size: int):
        if self.body:
            yield self.body


class FakeResponse:
    def __init__(self, status: int, body: bytes = b"") -> None:
        self.status = status
        self.content_length = len(body)
        self.content = FakeContent(body)

    async def __aenter__(self):
        return self

    async def __aexit__(self, _exc_type, _exc, _traceback):
        return False


class FakeSession:
    def __init__(self, *responses: FakeResponse) -> None:
        self.responses = list(responses)
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.responses.pop(0)


class FakeClient:
    validate_ssl = False

    def __init__(self) -> None:
        self.legacy_event_calls = 0

    async def get_auth_headers(self):
        return {"Authorization": "test-header"}

    async def async_get_event(self, _event_id):
        self.legacy_event_calls += 1
        raise AssertionError("The noisy Frigate wrapper must not be used")


class SecondAuthCallFailsClient(FakeClient):
    def __init__(self) -> None:
        super().__init__()
        self.auth_calls = 0

    async def get_auth_headers(self):
        self.auth_calls += 1
        if self.auth_calls == 2:
            raise RuntimeError("permanent auth-header failure without status")
        return {"Authorization": "test-header"}


class FakeConfigEntry:
    def __init__(self) -> None:
        self.entry_id = "frigate-entry"
        self.data = {"url": "https://frigate.example.test"}


class AdapterTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.analysis = ANALYSIS
        cls.event_id = "example-event-id"

    def adapter(self, *responses):
        client = FakeClient()
        adapter = self.analysis.FrigateAdapter(
            FakeHass(),
            FakeConfigEntry(),
            client,
        )
        adapter._session = FakeSession(*responses)
        return adapter, client

    async def test_direct_event_request_forwards_auth_and_ssl(self) -> None:
        body = b'{"id":"example-event-id","data":{"description":""}}'
        adapter, client = self.adapter(FakeResponse(200, body))

        event = await adapter.get_event(self.event_id, timeout=3.0)

        self.assertEqual(event["id"], self.event_id)
        self.assertEqual(client.legacy_event_calls, 0)
        _url, kwargs = adapter._session.calls[0]
        self.assertEqual(kwargs["headers"]["Authorization"], "test-header")
        self.assertFalse(kwargs["ssl"])
        self.assertLessEqual(kwargs["timeout"].total, 3.0)

    def test_http_status_classification(self) -> None:
        for status in (404, 408, 425, 429, 500, 503, 599):
            with self.subTest(status=status):
                error = self.analysis.FrigateAdapter._http_error(
                    "Snapshot",
                    self.event_id,
                    status,
                )
                self.assertTrue(error.transient)
                self.assertEqual(error.status, status)

        for status in (400, 401, 403, 410, 422):
            with self.subTest(status=status):
                error = self.analysis.FrigateAdapter._http_error(
                    "Snapshot",
                    self.event_id,
                    status,
                )
                self.assertFalse(error.transient)
                self.assertEqual(error.status, status)

    async def test_empty_snapshot_is_transient(self) -> None:
        adapter, _client = self.adapter(FakeResponse(200, b""))
        with self.assertRaises(self.analysis.FrigateEventError) as context:
            await adapter.get_snapshot(self.event_id, timeout=3.0)
        self.assertTrue(context.exception.transient)

    async def test_recording_snapshot_uses_exact_camera_and_timestamp(self) -> None:
        adapter, _client = self.adapter(FakeResponse(200, jpeg()))

        result = await adapter.get_recording_snapshot(
            self.event_id,
            "ultra_wide",
            1720000000.125,
            timeout=3.0,
        )

        self.assertTrue(result)
        url, kwargs = adapter._session.calls[0]
        self.assertEqual(
            str(url),
            "https://frigate.example.test/api/ultra_wide/recordings/"
            "1720000000.125000/snapshot.jpg",
        )
        self.assertEqual(kwargs["headers"]["Authorization"], "test-header")
        self.assertFalse(kwargs["ssl"])

    async def test_statusless_auth_failure_does_not_enter_detect_fallback(self) -> None:
        event_body = (
            b'{"id":"example-event-id","camera":"driveway",'
            b'"start_time":100.0,"data":{}}'
        )
        client = SecondAuthCallFailsClient()
        adapter = self.analysis.FrigateAdapter(
            FakeHass(),
            FakeConfigEntry(),
            client,
        )
        adapter._session = FakeSession(
            FakeResponse(200, event_body),
            FakeResponse(200, event_body),
            FakeResponse(200, jpeg()),
        )
        runtime = self.analysis.RuntimeData(
            hass=FakeHass(),
            entry=FakeEntry(),
            frigate_entry=None,
            provider=FakeProvider(self.analysis),
            frigate=adapter,
        )

        with self.assertRaises(self.analysis.FrigateAuthenticationError) as context:
            await self.analysis._wait_for_recording_snapshot(
                runtime,
                event_id=self.event_id,
                force=False,
                wait_timeout=20,
            )

        self.assertIsNone(context.exception.status)
        self.assertEqual(client.auth_calls, 2)
        self.assertEqual(len(adapter._session.calls), 1)

    async def test_invalid_event_json_and_wrong_id_are_permanent(self) -> None:
        for body in (
            b"not-json",
            b'{"id":"another-event","data":{}}',
        ):
            with self.subTest(body=body):
                adapter, _client = self.adapter(FakeResponse(200, body))
                with self.assertRaises(self.analysis.FrigateEventError) as context:
                    await adapter.get_event(self.event_id, timeout=3.0)
                self.assertFalse(context.exception.transient)

    def test_non_image_content_is_a_permanent_source_error(self) -> None:
        with self.assertRaises(self.analysis.SourceError):
            self.analysis._prepare_jpeg(b"not-an-image", 1280)


if __name__ == "__main__":
    unittest.main()
