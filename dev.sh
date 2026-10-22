#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
for dir in tide-sim backend web; do
  [ -d "$dir/node_modules" ] || (cd "$dir" && npm install)
done
trap 'kill 0' EXIT
(cd tide-sim && npm run dev) &
sleep 3
(cd backend && npm run dev) &
(cd web && npm run dev) &
wait
