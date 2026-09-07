#!/usr/bin/env bash
# Deploy CampusOS on the app server.
#
#   ssh root@<host> 'cd /opt/apps/project4 && ./scripts/deploy.sh'
#
# Run it under tmux (or nohup) — the build takes minutes and an SSH drop
# would otherwise kill it halfway.
set -euo pipefail

cd "$(dirname "$0")/.."
LOG=/tmp/deploy_build.log

# Swap is what stops a build from taking the machine down with it. The box
# has run out of memory mid-build twice, each time leaving sshd unable to
# answer and the site unreachable until it recovered on its own.
ensure_swap() {
  if [ "$(swapon --show --noheadings | wc -l)" -gt 0 ]; then
    echo "swap: already configured"
    return
  fi
  echo "swap: creating 2G at /swapfile"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
}

ensure_swap
free -m | head -2

echo "deploying $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"

: > "$LOG"
docker compose -f docker-compose.prod.yml build app >> "$LOG" 2>&1
echo "BUILD_EXIT=$?" >> "$LOG"

docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
echo "deployed. log: $LOG"
