"""Run the optional Frigate Vision smoke test on a local Linux Docker engine."""

from __future__ import annotations

import argparse
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE = (
    "ghcr.io/home-assistant/home-assistant:2026.11.2@"
    "sha256:493a07e8f6530fc640223f4a0a5248f20a61ca2f718bb1d31efbf08a2c5ea28f"
)

BROWSER_IMAGE = (
    "mcr.microsoft.com/playwright:v1.65.1-noble@"
    "sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579"
)


def output(*args: str) -> str:
    return subprocess.check_output(args, text=True, timeout=30).strip()


def local_docker() -> list[str]:
    # Pin every command (including cleanup) to the same verified local context.
    context = output("docker", "context", "show")
    docker = ["docker", "--context", context]
    endpoint = output(
        *docker, "context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}"
    )
    if not endpoint.startswith(("unix:///", "npipe:////./pipe/")):
        raise ValueError(
            "Select a local Docker context (Unix socket or local named pipe)."
        )
    if output(*docker, "info", "--format", "{{.OSType}}") != "linux":
        raise ValueError("A running local Linux Docker engine is required.")
    return docker


def ensure_image(docker: list[str], image: str) -> None:
    if subprocess.run(
        [*docker, "image", "inspect", image],
        check=False,
        timeout=30,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode:
        print(f"Pulling {image} (cached for subsequent runs)", flush=True)
        subprocess.run([*docker, "pull", image], check=True, timeout=900)


def audio_browser(docker: list[str], name: str, label: str, deadline: float) -> None:
    """Share the fixture's isolated network namespace; pass its token only on stdin."""
    marker = "/config/audio-test.json"
    while time.monotonic() < deadline:
        if output(*docker, "inspect", "--format", "{{.State.Running}}", name) != "true":
            raise RuntimeError("HA audio fixture exited during startup")
        ready = subprocess.run(
            [*docker, "exec", name, "test", "-s", marker], check=False, timeout=10
        )
        if ready.returncode == 0:
            break
        time.sleep(0.4)
    else:
        raise subprocess.TimeoutExpired("HA audio fixture startup", 0)

    bootstrap = subprocess.check_output(
        [*docker, "exec", name, "cat", marker], timeout=10
    )
    subprocess.run(
        [
            *docker,
            "run",
            "--rm",
            "-i",
            "--pull=never",
            "--label",
            label,
            "--network",
            f"container:{name}",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--mount",
            f"type=bind,src={ROOT / 'node_modules' / 'playwright-core'},dst=/opt/playwright-core,readonly",
            "--mount",
            f"type=bind,src={ROOT / 'tests' / 'ha_container' / 'audio'},dst=/audio,readonly",
            "--entrypoint",
            "node",
            BROWSER_IMAGE,
            "/audio/browser.mjs",
        ],
        input=bootstrap,
        check=True,
        timeout=max(1, deadline - time.monotonic()),
    )


def run(timeout: int, audio: bool = False) -> None:
    docker = local_docker()
    ensure_image(docker, IMAGE)
    if audio:
        if not (ROOT / "node_modules/playwright-core/index.mjs").is_file():
            raise ValueError("Run npm ci before --audio.")
        ensure_image(docker, BROWSER_IMAGE)
    deadline = time.monotonic() + timeout
    name = f"frigate-vision-smoke-{uuid.uuid4().hex}"
    label = f"io.github.agrestisdavid.frigate-vision.smoke={name}"
    print(f"Starting {name} (isolated, timeout {timeout}s)", flush=True)
    network = "none"
    try:
        if audio:
            # Chromium ICE needs a non-loopback interface. No external route, host
            # bridge address, published port or attachment to an existing network.
            network = output(
                *docker,
                "network",
                "create",
                "--internal",
                "--driver",
                "bridge",
                "--opt",
                "com.docker.network.bridge.gateway_mode_ipv4=isolated",
                "--label",
                label,
                name,
            )
        subprocess.run(
            [
                *docker,
                "run",
                "--detach" if audio else "--rm",
                "--pull=never",
                "--name",
                name,
                "--label",
                label,
                "--network",
                network,
                "--tmpfs",
                "/config",
                "--cap-drop=ALL",
                "--security-opt=no-new-privileges",
                "--mount",
                f"type=bind,src={ROOT / 'custom_components' / 'frigate_vision'},dst=/config/custom_components/frigate_vision,readonly",
                "--mount",
                f"type=bind,src={ROOT / 'tests' / 'ha_container'},dst=/smoke,readonly",
                "--entrypoint",
                "python3",
                IMAGE,
                "-I",  # Ignore ambient PYTHON* settings, including PYTHONOPTIMIZE.
                "-B",
                "-u",
                "/smoke/scenario.py",
                *(["--audio"] if audio else []),
            ],
            check=True,
            timeout=timeout,
        )
        if audio:
            # Browser diagnostics show only protocol stages. Do not dump raw HA
            # HTTP logs: a rejected handshake can contain a signed request URL.
            audio_browser(docker, name, label, deadline)
    finally:
        # A timeout or Ctrl+C can kill the CLI before the container's PID 1 exits.
        # --rm covers normal exits; only remove IDs carrying *this run's* label.
        for container_id in output(
            *docker, "ps", "-aq", "--no-trunc", "--filter", f"label={label}"
        ).splitlines():
            subprocess.run([*docker, "rm", "-fv", container_id], check=True, timeout=30)
        if audio:
            for net_id in output(
                *docker,
                "network",
                "ls",
                "-q",
                "--no-trunc",
                "--filter",
                f"label={label}",
            ).splitlines():
                subprocess.run(
                    [*docker, "network", "rm", net_id], check=True, timeout=30
                )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        metavar="SECONDS",
        help="container run deadline, excluding image pull (default: 120)",
    )
    parser.add_argument(
        "--audio",
        action="store_true",
        help="verify both live audio directions in isolated Chromium and go2rtc instead",
    )
    args = parser.parse_args()
    if args.timeout < 1:
        parser.error("--timeout must be positive")
    try:
        run(args.timeout, audio=args.audio)
    except KeyboardInterrupt:
        print("Smoke test interrupted.", file=sys.stderr)
        return 130
    except subprocess.TimeoutExpired as err:
        print(
            f"HA container smoke test timed out after {err.timeout}s.", file=sys.stderr
        )
        return 1
    except subprocess.CalledProcessError as err:
        print(
            f"Docker exited with status {err.returncode}; see output above.",
            file=sys.stderr,
        )
        return 1
    except (OSError, RuntimeError, ValueError) as err:
        print(f"HA container smoke test failed: {err}", file=sys.stderr)
        return 1
    print("HA container smoke test passed; disposable container removed.")
    return 0


if __name__ == "__main__":
    # On POSIX a CI cancellation can signal only the runner, not the Docker CLI.
    signal.signal(signal.SIGTERM, signal.default_int_handler)
    sys.exit(main())
