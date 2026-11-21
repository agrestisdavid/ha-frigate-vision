FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579

# Test-only audio backend. Runtime uses the null sink exclusively; do not load
# hardware discovery or the distro default PulseAudio configuration.
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends pulseaudio pulseaudio-utils \
    && rm -rf /var/lib/apt/lists/*
