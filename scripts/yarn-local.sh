#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
YARN_CJS="${REPO_ROOT}/.yarn/releases/yarn-4.17.1.cjs"

if [[ ! -f "${YARN_CJS}" ]]; then
  echo "Pinned Yarn runtime not found at: ${YARN_CJS}" >&2
  echo "Run from the shoebox repository root where .yarn/releases is present." >&2
  exit 1
fi

if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif command -v nodejs >/dev/null 2>&1; then
  NODE_BIN="$(command -v nodejs)"
else
  NODE_BIN=""
  for candidate in /usr/bin/node /usr/local/bin/node; do
    if [[ -x "${candidate}" ]]; then
      NODE_BIN="${candidate}"
      break
    fi
  done

  if [[ -z "${NODE_BIN}" ]]; then
    NVM_BASE="${NVM_DIR:-${HOME}/.nvm}"
    for candidate in "${NVM_BASE}"/versions/node/*/bin/node; do
      if [[ -x "${candidate}" ]]; then
        NODE_BIN="${candidate}"
      fi
    done
  fi

  if [[ -z "${NODE_BIN}" ]]; then
    echo "Node.js binary not found (checked PATH, /usr/bin, /usr/local/bin, and nvm directories)." >&2
    exit 1
  fi
fi

exec "${NODE_BIN}" "${YARN_CJS}" "$@"