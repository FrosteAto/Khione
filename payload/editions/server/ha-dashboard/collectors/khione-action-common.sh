#!/bin/bash
# Sourced by the Security dashboard's action-bridge scripts (khione-action-*),
# not run directly.
set -uo pipefail

# Deletes $1 and returns success only if it existed and was touched within
# the last 2 minutes. A stale trigger (e.g. one written while the matching
# .path unit was disabled) must never fire the action once the unit is
# finally enabled.
consume_trigger() {
  local trigger="$1"
  if [[ ! -f "$trigger" ]] || [[ -z "$(find "$trigger" -mmin -2 2>/dev/null)" ]]; then
    rm -f "$trigger"
    return 1
  fi
  rm -f "$trigger"
}
