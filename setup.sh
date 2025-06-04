#!/bin/bash

# Exit on error
set -e

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Install ffmpeg if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    if ! command -v ffmpeg &> /dev/null; then
        echo "Installing ffmpeg with Homebrew..."
        brew install ffmpeg
    else
        echo "ffmpeg already installed."
    fi
fi

echo "Setup complete! Activate your environment with: source venv/bin/activate" 