"""Run the optional Frigate Vision smoke test on a local Linux Docker engine."""

from __future__ import annotations

import argparse
import signal
import subprocess
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE = (
    "ghcr.io/home-assistant/home-assistant:2026.11.2@"
    "sha256:493a07e8f6530fc640223f4a0a5248f20a61ca2f718bb1d31efbf08a2c5ea28f"
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


def run(timeout: int) -> None:
    docker = local_docker()
    if subprocess.run(
        [*docker, "image", "inspect", IMAGE],
        check=False,
        timeout=30,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).returncode:
        print(f"Pulling {IMAGE} (cached for subsequent runs)", flush=True)
        subprocess.run([*docker, "pull", IMAGE], check=True, timeout=900)

    name = f"frigate-vision-smoke-{uuid.uuid4().hex}"
    label = f"io.github.agrestisdavid.frigate-vision.smoke={name}"
    print(f"Starting {name} (isolated, timeout {timeout}s)", flush=True)
    try:
        subprocess.run(
            [
                *docker,
                "run",
                "--rm",
                "--pull=never",
                "--name",
                name,
                "--label",
                label,
                "--network=none",
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
            ],
            check=True,
            timeout=timeout,
        )
    finally:
        # A timeout or Ctrl+C can kill the CLI before the container's PID 1 exits.
        # --rm covers normal exits; only remove IDs carrying *this run's* label.
        for container_id in output(
            *docker, "ps", "-aq", "--no-trunc", "--filter", f"label={label}"
        ).splitlines():
            subprocess.run([*docker, "rm", "-fv", container_id], check=True, timeout=30)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        metavar="SECONDS",
        help="container run deadline, excluding image pull (default: 120)",
    )
    args = parser.parse_args()
    if args.timeout < 1:
        parser.error("--timeout must be positive")
    try:
        run(args.timeout)
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
    except (OSError, ValueError) as err:
        print(f"HA container smoke test failed: {err}", file=sys.stderr)
        return 1
    print("HA container smoke test passed; disposable container removed.")
    return 0


if __name__ == "__main__":
    # On POSIX a CI cancellation can signal only the runner, not the Docker CLI.
    signal.signal(signal.SIGTERM, signal.default_int_handler)
    sys.exit(main())
