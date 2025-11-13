FROM node:22-bookworm

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

# Ensure the vscode user uses the bundled Node version by default
RUN echo 'export PATH=/usr/local/bin:$PATH' >> /home/vscode/.bashrc && \
    echo 'if command -v corepack >/dev/null 2>&1; then corepack enable; fi' >> /home/vscode/.bashrc

WORKDIR /workspaces
