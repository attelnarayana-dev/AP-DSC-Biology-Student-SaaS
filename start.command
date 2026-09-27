#!/bin/bash
cd "$(dirname "$0")"
PORT=3000
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "Node.js is required" message "Install Node.js (LTS) and then open start.command again." as critical'
  exit 1
fi
if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
  open "http://127.0.0.1:$PORT/"
  exit 0
fi
node server.js >/tmp/apdsc-biology-server.log 2>&1 &
PID=$!
for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    open "http://127.0.0.1:$PORT/"
    echo "AP DSC Biology Student SaaS running at http://127.0.0.1:$PORT"
    echo "Server PID: $PID"
    exit 0
  fi
  sleep 0.2
done
echo "Server did not start. Check /tmp/apdsc-biology-server.log"
cat /tmp/apdsc-biology-server.log
exit 1
