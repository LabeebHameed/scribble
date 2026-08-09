#!/usr/bin/env bash
# Scribble functional integration tests — hits live API like a user would.
set -euo pipefail

BASE="${SCRIBBLE_BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0
RESULTS=()

log() { echo ""; echo "=== $1 ==="; }
ok() { PASS=$((PASS+1)); RESULTS+=("PASS: $1"); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); RESULTS+=("FAIL: $1 — $2"); echo "  ✗ $1 — $2"; }

api() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$BASE$path" -H 'Content-Type: application/json' -d "$body"
  else
    curl -s -X "$method" "$BASE$path"
  fi
}

log "0. Health"
health=$(api GET /api/health)
echo "$health" | grep -q '"ok":true' && ok "health endpoint" || bad "health endpoint" "$health"

log "1. Capture: remind me to drink water in 5 minutes"
cap1=$(api POST /api/captures '{"rawText":"remind me to drink water in 5 minutes","autoConfirm":true}')
echo "$cap1" | node -pe "const j=JSON.parse(require('fs').readFileSync(0)); 'created: '+((j.created||[]).map(c=>c.type).join(', '))"
has_task=$(echo "$cap1" | node -pe "JSON.parse(require('fs').readFileSync(0)).created?.some(c=>c.type==='task')?1:0")
has_rem=$(echo "$cap1" | node -pe "JSON.parse(require('fs').readFileSync(0)).created?.some(c=>c.type==='reminder')?1:0")
[ "$has_task" = "1" ] && ok "capture creates task from reminder" || bad "capture task" "missing"
[ "$has_rem" = "1" ] && ok "capture schedules reminder" || bad "capture reminder" "missing"

log "2. Capture: meeting at 3:30"
cap2=$(api POST /api/captures '{"rawText":"I have a meeting at 3:30 with the team","autoConfirm":true}')
echo "$cap2" | node -pe "const j=JSON.parse(require('fs').readFileSync(0)); 'created: '+((j.created||[]).map(c=>c.type+':'+c.title).join(', '))"
has_event=$(echo "$cap2" | node -pe "JSON.parse(require('fs').readFileSync(0)).created?.some(c=>c.type==='event')?1:0")
[ "$has_event" = "1" ] && ok "capture creates calendar event" || bad "capture event" "missing"

log "3. Capture: call mom tomorrow"
cap3=$(api POST /api/captures '{"rawText":"call mom tomorrow","autoConfirm":true}')
echo "$cap3" | node -pe "const j=JSON.parse(require('fs').readFileSync(0)); 'created: '+((j.created||[]).map(c=>c.title).join(', '))"
task_count=$(echo "$cap3" | node -pe "(JSON.parse(require('fs').readFileSync(0)).created||[]).filter(c=>c.type==='task').length")
[ "$task_count" -ge 1 ] && ok "capture creates call task" || bad "call mom task" "missing"

log "4. Capture: low energy"
cap4=$(api POST /api/captures '{"rawText":"low energy today, foggy brain","autoConfirm":true}')
energy_count=$(echo "$cap4" | node -pe "(JSON.parse(require('fs').readFileSync(0)).created||[]).filter(c=>c.type==='energy').length")
[ "$energy_count" -ge 1 ] && ok "capture logs energy" || bad "energy" "missing"

log "5. Chat: remind me to stretch in 10 minutes"
chat1=$(api POST /api/chat '{"message":"remind me to stretch in 10 minutes"}')
reply1=$(echo "$chat1" | node -pe "JSON.parse(require('fs').readFileSync(0)).message?.content||''")
echo "  reply: ${reply1:0:100}"
echo "$reply1" | grep -qi "reminder" && ok "chat sets reminder" || bad "chat reminder" "$reply1"

log "6. Chat: meeting at 3:30"
chat2=$(api POST /api/chat '{"message":"I have a meeting at 3:30 with Sarah"}')
reply2=$(echo "$chat2" | node -pe "JSON.parse(require('fs').readFileSync(0)).message?.content||''")
echo "  reply: ${reply2:0:120}"
echo "$reply2" | grep -qi "event\|meeting\|3:30" && ok "chat handles meeting" || bad "chat meeting" "$reply2"

log "7. Chat: plan my day"
chat3=$(api POST /api/chat '{"message":"plan my day"}')
reply3=$(echo "$chat3" | node -pe "JSON.parse(require('fs').readFileSync(0)).message?.content||''")
echo "  reply: ${reply3:0:120}"
echo "$reply3" | grep -qi "proposed\|block\|today\|plan" && ok "chat plans day" || bad "chat plan" "$reply3"

log "8. Chat: what's on my plate"
chat4=$(api POST /api/chat '{"message":"what is on my plate today"}')
reply4=$(echo "$chat4" | node -pe "JSON.parse(require('fs').readFileSync(0)).message?.content||''")
echo "  reply: ${reply4:0:120}"
[ ${#reply4} -gt 10 ] && ok "chat lists tasks" || bad "chat list" "empty"

log "9. Plan timeline has blocks"
blocks=$(api GET /api/plan)
count=$(echo "$blocks" | node -pe "(JSON.parse(require('fs').readFileSync(0)).blocks||[]).length")
echo "  blocks: $count"
[ "${count:-0}" -ge 1 ] && ok "today timeline has blocks" || bad "timeline" "empty"

log "10. Schedule shows events"
events=$(api GET /api/events)
ev=$(echo "$events" | node -pe "(JSON.parse(require('fs').readFileSync(0)).events||[]).length")
echo "  events: $ev"
[ "${ev:-0}" -ge 1 ] && ok "events on schedule" || bad "schedule events" "none"

log "11. Reminders due activation"
tasks=$(api GET '/api/tasks?filter=open')
tid=$(echo "$tasks" | node -pe "JSON.parse(require('fs').readFileSync(0)).tasks?.[0]?.id||''")
if [ -n "$tid" ]; then
  api POST /api/reminders "{\"taskId\":\"$tid\",\"actionLanguage\":\"Drink water now\",\"fireInMinutes\":0}" >/dev/null
  sleep 1
  rems=$(api GET /api/reminders)
  needs=$(echo "$rems" | node -pe "(JSON.parse(require('fs').readFileSync(0)).needsAttention||[]).length")
  echo "  needsAttention: $needs"
  [ "${needs:-0}" -ge 1 ] && ok "due reminders in needsAttention" || bad "reminders due" "empty"
else
  bad "reminders due" "no task"
fi

log "12. Memory still works"
mem=$(api GET '/api/memory?q=water')
hits=$(echo "$mem" | node -pe "(JSON.parse(require('fs').readFileSync(0)).hits||[]).length")
[ "${hits:-0}" -ge 1 ] && ok "memory search works" || bad "memory" "no hits"

log "SUMMARY"
echo "Passed: $PASS  Failed: $FAIL"
printf '%s\n' "${RESULTS[@]}"
[ "$FAIL" -eq 0 ]
