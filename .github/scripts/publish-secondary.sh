#!/usr/bin/env bash
set -euo pipefail
umask 077

key="$RUNNER_TEMP/secondary-release-key"
known="$RUNNER_TEMP/secondary-known-hosts"
askpass="$RUNNER_TEMP/secondary-release-askpass"
cleanup() {
  if [[ -n "${secondary_agent:-}" ]]; then ssh-agent -k >/dev/null 2>&1 || true; fi
  rm -f "$key" "$known" "$askpass"
}
trap cleanup EXIT

publish() {
  local digest image_id
  [[ "$ARTIFACT_READY" == true ]] || return 1
  [[ "$SSH_HOST" && "$SSH_PORT" && "$SSH_USER" && "$SSH_KEY" && "$SSH_KEY_PASSPHRASE" && "$SSH_KNOWN_HOSTS" ]] || return 1
  [[ "$REVISION" =~ ^[a-f0-9]{40}$ && "$SSH_PORT" =~ ^[0-9]+$ ]] || return 1
  test "$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq .object.sha)" = "$GITHUB_SHA" || return 1
  python3 "$(dirname "$0")/secondary_artifact.py" verify secondary || return 1
  printf '%s\n' "$SSH_KEY" | tr -d '\r' > "$key" || return 1
  printf '%s\n' "$SSH_KNOWN_HOSTS" | tr -d '\r' > "$known" || return 1
  eval "$(ssh-agent -s)" >/dev/null || return 1
  [[ -n "${SSH_AUTH_SOCK:-}" && -n "${SSH_AGENT_PID:-}" ]] || return 1
  secondary_agent=started
  printf '#!/bin/sh\nprintf "%%s\\n" "$SSH_KEY_PASSPHRASE"\n' > "$askpass" || return 1
  chmod 700 "$askpass" || return 1
  SSH_ASKPASS="$askpass" SSH_ASKPASS_REQUIRE=force ssh-add -t 600 "$key" </dev/null || return 1
  digest=$(jq -er .archive_sha256 secondary/secondary-manifest.json) || return 1
  image_id=$(jq -er .image_id secondary/secondary-manifest.json) || return 1
  timeout 480 ssh -i "$key" -p "$SSH_PORT" -o BatchMode=yes -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$known" -o ConnectTimeout=15 \
    -o ServerAliveInterval=20 -o ServerAliveCountMax=3 "$SSH_USER@$SSH_HOST" \
    "publish $REVISION $digest $image_id" < secondary/secondary-image.tar.gz > "$RUNNER_TEMP/secondary-receipt.json" || return 1
  jq -e --arg revision "$REVISION" --arg id "$image_id" \
    '.ok == true and .revision == $revision and .image_id == $id' \
    "$RUNNER_TEMP/secondary-receipt.json" > /dev/null
}

# Keep raw SSH and deployment output off the public workflow.
if publish 2>"$RUNNER_TEMP/secondary-private-errors.log"; then
  jq -n --arg revision "$REVISION" '{status:"success",revision:$revision}' > secondary-result.json
else
  echo '::warning::Secondary application release is degraded or unverified.'
  printf '{"status":"degraded"}\n' > secondary-result.json
fi
