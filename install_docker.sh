#!/bin/bash
set -e

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    echo "OS not supported"
    exit 1
fi

echo "Detected OS: $OS $VER"

# Update package index
sudo apt-get update

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Install Docker
sudo apt-get install -y docker.io docker-compose

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group if not already
if ! groups $USER | grep &>/dev/null 'docker'; then
  sudo usermod -aG docker $USER
  echo "User added to docker group. You may need to log out and back in for this to take effect."
fi

echo "Docker installation complete."
docker --version
docker-compose --version
