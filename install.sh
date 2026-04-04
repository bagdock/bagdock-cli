#!/usr/bin/env bash
# Bagdock CLI installer for macOS and Linux
# Usage: curl -fsSL https://bdok.dev/install.sh | bash
#
# Respects BAGDOCK_INSTALL for custom install dir (default: ~/.bagdock/bin)

set -euo pipefail

INSTALL_DIR="${BAGDOCK_INSTALL:-$HOME/.bagdock/bin}"
PACKAGE="@bagdock/cli"

info()  { printf "\033[1;34m%s\033[0m\n" "$1"; }
ok()    { printf "\033[1;32m%s\033[0m\n" "$1"; }
err()   { printf "\033[1;31m%s\033[0m\n" "$1" >&2; exit 1; }

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux*)  OS="linux" ;;
    Darwin*) OS="darwin" ;;
    *)       err "Unsupported OS: $os" ;;
  esac

  case "$arch" in
    x86_64|amd64) ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *)             err "Unsupported architecture: $arch" ;;
  esac
}

check_deps() {
  for cmd in node npm; do
    if ! command -v "$cmd" &>/dev/null; then
      err "Required: $cmd. Install Node.js 20+ from https://nodejs.org"
    fi
  done

  local node_major
  node_major=$(node -e 'console.log(process.versions.node.split(".")[0])')
  if [ "$node_major" -lt 20 ]; then
    err "Node.js 20+ required (found v${node_major}). Update at https://nodejs.org"
  fi
}

install_via_npm() {
  info "Installing ${PACKAGE}..."
  npm install -g "$PACKAGE" 2>&1
}

install_to_dir() {
  info "Installing ${PACKAGE} to ${INSTALL_DIR}..."

  mkdir -p "$INSTALL_DIR"

  local tmpdir
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  cd "$tmpdir"
  npm pack "$PACKAGE" --quiet 2>/dev/null
  tar xzf *.tgz

  cp package/dist/bagdock.js "$INSTALL_DIR/bagdock"
  chmod +x "$INSTALL_DIR/bagdock"

  add_to_path
}

add_to_path() {
  if echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
    return
  fi

  local rc_file=""
  local shell_name
  shell_name="$(basename "${SHELL:-/bin/bash}")"

  case "$shell_name" in
    zsh)  rc_file="$HOME/.zshrc" ;;
    bash)
      if [ -f "$HOME/.bashrc" ]; then
        rc_file="$HOME/.bashrc"
      else
        rc_file="$HOME/.bash_profile"
      fi
      ;;
    fish) rc_file="$HOME/.config/fish/config.fish" ;;
    *)    rc_file="$HOME/.profile" ;;
  esac

  if [ -n "$rc_file" ]; then
    local line="export PATH=\"${INSTALL_DIR}:\$PATH\""
    if [ "$shell_name" = "fish" ]; then
      line="set -gx PATH ${INSTALL_DIR} \$PATH"
    fi

    if ! grep -qF "$INSTALL_DIR" "$rc_file" 2>/dev/null; then
      printf "\n# Bagdock CLI\n%s\n" "$line" >> "$rc_file"
      info "Added ${INSTALL_DIR} to PATH in ${rc_file}"
      info "Run: source ${rc_file}"
    fi
  fi
}

main() {
  info "Bagdock CLI Installer"
  echo

  detect_platform
  check_deps

  if [ -n "${BAGDOCK_INSTALL:-}" ]; then
    install_to_dir
  else
    install_via_npm
  fi

  echo
  ok "Bagdock CLI installed successfully!"
  echo
  info "Get started:"
  echo "  bagdock login"
  echo "  bagdock doctor"
  echo "  bagdock init"
  echo
}

main "$@"
