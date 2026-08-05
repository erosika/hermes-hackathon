#!/usr/bin/env bash
# spark-mode — flip the sparks between hermetika serving and a cleared deck for big bring-ups (inkling).
set -euo pipefail

S1="eri@spark-1"
S2="eri@spark-2"
SSH="ssh -o ConnectTimeout=8 -o BatchMode=yes"

usage() {
  cat <<'EOF'
usage: spark-mode <command>

  status     what each spark is running (services, containers, memory)
  inkling    clear the sparks: stop diffusiongemma + ollama on both (weights stay on disk)
  hermetika  restore normal serving: start ollama on both + diffusiongemma on spark-1

the gateway rediscovers residency within ~15s of a flip; the UI skulls/unskulls itself.
launching the inkling cluster itself lives in spark-vllm-docker (recipes/inkling-small-nvfp4).
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

case "${1:-}" in
  status)
    status_host "$S1"
    status_host "$S2"
    ;;
  inkling)
    echo "clearing the sparks — nothing is deleted, weights stay on disk"
    if $SSH "$S1" 'docker stop diffusiongemma' >/dev/null 2>&1; then
      echo "   spark-1: diffusiongemma stopped"
    else
      echo "   spark-1: diffusiongemma already stopped (or unreachable)"
    fi
    stop_ollama "$S1"
    stop_ollama "$S2"
    echo "done — hermetika-auth stays up; gateway shows the models down within ~15s"
    echo "next: launch the cluster from spark-vllm-docker (recipes/inkling-small-nvfp4)"
    ;;
  hermetika)
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
