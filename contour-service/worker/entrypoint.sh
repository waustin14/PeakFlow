#!/usr/bin/env sh
set -e
celery -A worker.tasks worker --loglevel=INFO
