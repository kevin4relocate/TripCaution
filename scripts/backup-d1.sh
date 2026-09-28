#!/usr/bin/env bash
# Owner-run, NON-DESTRUCTIVE backup. Never commits or restores production D1.
set -euo pipefail
umask 077
if ! command -v npx >/dev/null 2>&1; then
 echo "Node.js/npm is required. Install it, then rerun this script." >&2;exit 2
fi
destination="${1:-${HOME}/tripcaution-secure-backups}"
mkdir -p -- "$destination"
if [[ -L "$destination" ]]; then
 echo "Refusing to write a backup through a symbolic-link folder." >&2;exit 2
fi
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="${destination%/}/tripcaution-prod-${stamp}.sql"
if [[ -e "$file" ]]; then
 echo "Refusing to overwrite an existing backup: $file" >&2;exit 2
fi
echo "Exporting tripcaution-db from remote D1 to $file"
# Run wrangler login on YOUR computer first. No Cloudflare token should be
# pasted into this script or committed to GitHub.
npx wrangler d1 export tripcaution-db --remote --output="$file"
chmod 600 -- "$file"
if [[ ! -s "$file" ]] || ! grep -Eiq 'CREATE TABLE[^;]*articles' "$file"; then
 echo "Backup appears incomplete. Do NOT delete production data. Check: $file" >&2
 exit 1
fi
if command -v shasum >/dev/null 2>&1;then shasum -a 256 "$file" > "$file.sha256"
elif command -v sha256sum >/dev/null 2>&1;then sha256sum "$file" > "$file.sha256"
else echo "SHA-256 utility unavailable. Manually record a checksum." >&2;fi
echo "BACKUP COMPLETE. Keep this file and its checksum outside any public repository."
echo "Path: $file"
echo "NEXT: restore only into a NEW staging D1 database to rehearse recovery; NEVER test-import into production."
