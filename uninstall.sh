#!/usr/bin/env bash
set -euo pipefail

# free-code uninstaller
# Usage: curl -fsSL https://raw.githubusercontent.com/paoloanzn/free-code/main/uninstall.sh | bash
#   --purge     Remove everything including user data (no confirmation)
#   --keep-data Remove only binary and source, keep user data (no confirmation)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

info()  { printf "${CYAN}[*]${RESET} %s\n" "$*"; }
ok()    { printf "${GREEN}[+]${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}[!]${RESET} %s\n" "$*"; }
fail()  { printf "${RED}[x]${RESET} %s\n" "$*"; exit 1; }

header() {
  echo ""
  printf "${BOLD}${CYAN}"
  cat << 'ART'
   ___                            _
  / _|_ __ ___  ___        ___ __| | ___
 | |_| '__/ _ \/ _ \_____ / __/ _` |/ _ \
 |  _| | |  __/  __/_____| (_| (_| |  __/
 |_| |_|  \___|\___|      \___\__,_|\___|

ART
  printf "${RESET}"
  printf "${DIM}  The free build of Claude Code${RESET}\n"
  echo ""
}

# -------------------------------------------------------------------
# Parse flags
# -------------------------------------------------------------------

PURGE=false
KEEP_DATA=false
for arg in "$@"; do
  case "$arg" in
    --purge)    PURGE=true ;;
    --keep-data) KEEP_DATA=true ;;
    *)
      warn "Unknown flag: $arg"
      echo ""
      echo "Usage: $0 [--purge|--keep-data]"
      echo "  --purge      Remove everything including user data (no confirmation)"
      echo "  --keep-data  Remove only binary and source, keep user data (no confirmation)"
      exit 1
      ;;
  esac
done

if $PURGE && $KEEP_DATA; then
  fail "Cannot use --purge and --keep-data together"
fi

# -------------------------------------------------------------------
# Read manifest
# -------------------------------------------------------------------

MANIFEST_FILE="$HOME/.claude/install-manifest.txt"
DEFAULT_PATHS=(
  "$HOME/free-code/"
  "$HOME/.local/bin/free-code"
)

USER_DATA_PATHS=(
  "$HOME/.claude/"
  "$HOME/.claude.json"
  "$HOME/.local/share/claude/"
  "$HOME/.cache/claude/"
  "$HOME/.local/state/claude/"
)

REMOVED_PATHS=()
PRESERVED_PATHS=()

# -------------------------------------------------------------------
# Remove installed files
# -------------------------------------------------------------------

remove_installed_files() {
  info "Removing installed files..."

  if [ -f "$MANIFEST_FILE" ]; then
    ok "Found manifest: $MANIFEST_FILE"
    while IFS= read -r line || [ -n "$line" ]; do
      # Skip comments and empty lines
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// /}" ]] && continue

      if [ -e "$line" ] || [ -L "$line" ]; then
        if [ -d "$line" ] && [ ! -L "$line" ]; then
          rm -rf "$line"
        else
          rm -f "$line"
        fi
        REMOVED_PATHS+=("$line")
      else
        # Path doesn't exist, skip silently
        REMOVED_PATHS+=("$line")
      fi
    done < "$MANIFEST_FILE"
  else
    warn "Manifest not found: $MANIFEST_FILE"
    warn "Falling back to default paths"
    for path in "${DEFAULT_PATHS[@]}"; do
      if [ -e "$path" ] || [ -L "$path" ]; then
        if [ -d "$path" ] && [ ! -L "$path" ]; then
          rm -rf "$path"
        else
          rm -f "$path"
        fi
      fi
      REMOVED_PATHS+=("$path")
    done
    # Also remove the manifest path itself if it somehow exists
    if [ -e "$MANIFEST_FILE" ]; then
      rm -f "$MANIFEST_FILE"
      REMOVED_PATHS+=("$MANIFEST_FILE")
    fi
  fi
}

# -------------------------------------------------------------------
# Handle user data
# -------------------------------------------------------------------

remove_user_data() {
  for path in "${USER_DATA_PATHS[@]}"; do
    if [ -e "$path" ] || [ -L "$path" ]; then
      if [ -d "$path" ] && [ ! -L "$path" ]; then
        rm -rf "$path"
      else
        rm -f "$path"
      fi
      REMOVED_PATHS+=("$path")
    fi
  done
}

preserve_user_data() {
  for path in "${USER_DATA_PATHS[@]}"; do
    if [ -e "$path" ] || [ -L "$path" ]; then
      PRESERVED_PATHS+=("$path")
    fi
  done
}

handle_user_data() {
  if $PURGE; then
    info "Purge mode: removing user data..."
    remove_user_data
    return
  fi

  if $KEEP_DATA; then
    info "Keep-data mode: preserving user data"
    preserve_user_data
    return
  fi

  # Interactive: ask the user
  echo ""
  printf "${YELLOW}Remove user data (configs, sessions, cache)? [y/N]${RESET} "
  read -r answer
  case "$answer" in
    [yY]|[yY][eE][sS])
      info "Removing user data..."
      remove_user_data
      ;;
    *)
      info "Preserving user data"
      preserve_user_data
      ;;
  esac
}

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------

print_summary() {
  echo ""
  if [ ${#REMOVED_PATHS[@]} -gt 0 ]; then
    printf "${RED}${BOLD}Removed:${RESET}\n"
    for path in "${REMOVED_PATHS[@]}"; do
      printf "  ${DIM}%s${RESET}\n" "$path"
    done
  fi

  if [ ${#PRESERVED_PATHS[@]} -gt 0 ]; then
    echo ""
    printf "${GREEN}${BOLD}Preserved (user data):${RESET}\n"
    for path in "${PRESERVED_PATHS[@]}"; do
      printf "  ${DIM}%s${RESET}\n" "$path"
    done
  fi
}

# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------

header
info "Starting uninstall..."
echo ""

remove_installed_files
handle_user_data

echo ""
ok "Uninstall complete"
print_summary
echo ""
