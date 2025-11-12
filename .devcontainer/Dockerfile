FROM node:20-bookworm

# Install necessary build tools and Python for node-gyp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash vscode
RUN mkdir -p /workspaces && chown -R vscode:vscode /workspaces

# Set up environment to avoid OpenSSL legacy issues
ENV NODE_OPTIONS="--no-deprecation"

WORKDIR /workspaces
