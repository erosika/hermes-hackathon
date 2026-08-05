#!/usr/bin/env bash
# spark-mode — flip the sparks between hermetika serving and the inkling dual-node cluster.
set -euo pipefail

S1="eri@spark-1"
S2="eri@spark-2"
SSH="ssh -o ConnectTimeout=8 -o BatchMode=yes"

# settled inkling launch (see dgx-spark/SPARK-LOG-inkling-small-sglang.md for the walls behind these)
INKLING_ENV='MASTER_IP=10.99.99.1 MODELS=$HOME/models/inkling GRAPH_BS=1'
LINK_IF="enp1s0f0np0"

usage() {
  cat <<'EOF'
usage: spark-mode <command>

  status     what each spark is running (services, containers, memory, endpoints)
  inkling    stop hermetika serving, launch the inkling TP=2 cluster (~20-25 min to serve)
  hermetika  tear down inkling, restore ollama on both + diffusiongemma on spark-1

the gateway rediscovers residency within ~15s of a flip; the UI skulls/unskulls itself.
inkling needs the 10.99.99.x link IPs, which do not survive reboots:
  sudo ip addr add 10.99.99.1/30 dev enp1s0f0np0   # spark-1
  sudo ip addr add 10.99.99.2/30 dev enp1s0f0np0   # spark-2
EOF
  exit 1
}

status_host() {
  local host="$1"
  echo "── ${host#*@}"
  if ! $SSH "$host" true 2>/dev/null; then
    echo "   unreachable"
    return
  fi
  $SSH "$host" '
    echo "   ollama: $(systemctl is-active ollama 2>/dev/null || echo unknown)"
    docker ps --format "   container: {{.Names}} ({{.Status}})" 2>/dev/null || echo "   docker: unavailable"
    curl -s -m 2 http://localhost:30000/health >/dev/null 2>&1 && echo "   inkling: serving on :30000" || true
    ip -4 addr show '"$LINK_IF"' 2>/dev/null | grep -q "10\.99\.99\." && echo "   link: 10.99.99.x up" || echo "   link: no 10.99.99.x address"
    free -g | awk "/^Mem:/ {printf \"   memory: %sG used / %sG total · %sG available\n\", \$3, \$2, \$7}"
  '
}

stop_ollama() {
  local host="$1"
  if $SSH "$host" 'sudo -n systemctl stop ollama' 2>/dev/null; then
    echo "   ${host#*@}: ollama stopped"
  else
    echo "   ${host#*@}: could not stop ollama (sudo wants a password) — run there: sudo systemctl stop ollama"
  fi
}

start_ollama() {
  local host="$1"
  if $SSH "$host" 'sudo -n systemctl start ollama' 2>/dev/null; then
    echo "   ${host#*@}: ollama running"
  else
    echo "   ${host#*@}: could not start ollama (sudo wants a password) — run there: sudo systemctl start ollama"
  fi
}

link_ok() {
  $SSH "$1" "ip -4 addr show $LINK_IF 2>/dev/null | grep -q '10\.99\.99\.'"
}

case "${1:-}" in
  status)
    status_host "$S1"
    status_host "$S2"
    ;;
  inkling)
    if ! link_ok "$S1" || ! link_ok "$S2"; then
      echo "link IPs missing — reboots drop them. run:"
      echo "  ssh -t $S1 'sudo ip addr add 10.99.99.1/30 dev $LINK_IF'"
      echo "  ssh -t $S2 'sudo ip addr add 10.99.99.2/30 dev $LINK_IF'"
      exit 1
    fi
    echo "clearing hermetika serving — nothing is deleted, weights stay on disk"
    if $SSH "$S1" 'docker stop diffusiongemma' >/dev/null 2>&1; then
      echo "   spark-1: diffusiongemma stopped"
    else
      echo "   spark-1: diffusiongemma already stopped (or unreachable)"
    fi
    stop_ollama "$S1"
    stop_ollama "$S2"
    echo "launching inkling cluster (worker first, then head)"
    $SSH -f "$S2" "cd ~/inkling-sglang && $INKLING_ENV nohup ./scripts/nvfp4-kv-boot.sh 1 > ~/inkling-boot.log 2>&1 < /dev/null &"
    sleep 8
    $SSH -f "$S1" "cd ~/inkling-sglang && $INKLING_ENV nohup ./scripts/nvfp4-kv-boot.sh 0 > ~/inkling-boot.log 2>&1 < /dev/null &"
    echo "booting — ~20-25 min to serve (160G load + JIT). watch: ssh $S1 'tail -f ~/inkling-boot.log'"
    echo "ready when this returns Paris: curl -s localhost:30000/v1/completions … (see SPARK-LOG)"
    ;;
  hermetika)
    echo "tearing down inkling"
    for h in "$S1" "$S2"; do
      $SSH "$h" 'docker rm -f inkling-sglang' >/dev/null 2>&1 && echo "   ${h#*@}: inkling-sglang removed" || true
    done
    echo "restoring hermetika serving"
    start_ollama "$S1"
    start_ollama "$S2"
    if $SSH "$S1" 'docker start diffusiongemma' >/dev/null 2>&1; then
      echo "   spark-1: diffusiongemma starting (vLLM takes a minute to load weights)"
    else
      echo "   spark-1: could not start diffusiongemma — check: docker ps -a"
    fi
    echo "done — gateway rediscovers residency within ~15s"
    ;;
  *)
    usage
    ;;
esac
