FROM mcr.microsoft.com/devcontainers/typescript-node:22

# System tools for development
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux \
    curl \
    wget \
    jq \
    htop \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm@latest

# Install Claude Code CLI (agent runs inside the container)
RUN npm install -g @anthropic-ai/claude-code@latest

# Install Expo CLI
RUN npm install -g expo-cli@latest eas-cli@latest

# Android SDK setup for mobile builds (optional - uncomment if needed)
# ENV ANDROID_HOME=/opt/android-sdk
# RUN mkdir -p ${ANDROID_HOME} && \
#     apt-get update && apt-get install -y openjdk-17-jdk wget unzip && \
#     wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdtools.zip && \
#     unzip -q /tmp/cmdtools.zip -d ${ANDROID_HOME}/cmdline-tools && \
#     mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest && \
#     rm /tmp/cmdtools.zip && \
#     yes | ${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager --licenses && \
#     ${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Set pnpm store directory inside the container
ENV PNPM_HOME="/home/node/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

# Keep container user as node (non-root)
USER node
