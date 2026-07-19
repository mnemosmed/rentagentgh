#!/usr/bin/env bash
# Render build script for RentAgentGhana.
# Runs from the `python/` directory (rootDir in render.yaml).
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Seed the agent directory on first deploy (idempotent).
python manage.py seed_agents || true
