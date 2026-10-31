#!/usr/bin/env bash
# End-to-end check of the Docker setup: builds the image, starts PostgreSQL + app + Caddy under a separate
# compose project (its own ports, network and volumes), exercises the site, admin, uploads and
# migrations, restarts everything and checks that data survived. Removes its containers and volumes at the end.
# Needs Docker with Compose v2, curl and Node.js on the host. Usage: bash docker/smoke-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=lf-smoke
HTTP_PORT=18080
BASE="http://127.0.0.1:${HTTP_PORT}"
WORK="$(mktemp -d)"
ENV_FILE="$WORK/smoke.env"
JAR="$WORK/cookies.txt"
DB_PASSWORD="smoke$(node -e "console.log(require('crypto').randomBytes(8).toString('hex'))")"

compose() { docker compose -p "$PROJECT" --env-file "$ENV_FILE" "$@"; }
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log($1)})"; }
fail() { echo "FAIL: $*" >&2; compose logs --tail 80 app >&2 || true; exit 1; }
step() { echo "--- $*"; }

cleanup() {
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

write_env() {
  cat >"$ENV_FILE" <<EOF
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_PORT=15432
ADMIN_USERNAME=smoke
ADMIN_PASSWORD_HASH=${1:-}
ADMIN_SESSION_SECRET=${2:-}
ADMIN_PATH=/studio
ADMIN_COOKIE_SECURE=false
SITE_ADDRESS=:80
HTTP_PORT=${HTTP_PORT}
HTTPS_PORT=18443
COMPOSE_SUBNET=172.29.0.0/24
EOF
}

step "build image"
write_env
compose build app

step "create a throwaway admin login"
PASSWORD="$(node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))")"
SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")"
HASH="$(compose run --rm --no-deps --entrypoint node app apps/api/dist/hash-password.js "$PASSWORD" | tail -n 1 | tr -d '\r')"
[[ "$HASH" == scrypt:v1:* ]] || fail "unexpected hash output: $HASH"
write_env "$HASH" "$SECRET"

step "start the stack"
compose up -d --wait --wait-timeout 180 || fail "stack did not become healthy"

step "public site, health, admin page"
curl -fsS "$BASE/" | grep -q '<div id="root">' || fail "site index"
[[ "$(curl -fsS "$BASE/api/health" | json 'd.database')" == "configured" ]] || fail "health"
curl -fsS "$BASE/studio" | grep -q 'name="lf-admin-path" content="/studio"' || fail "admin page"
[[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/admin")" == "404" ]] || fail "default admin path should be 404"

step "seed photos"
compose exec -T app node apps/api/dist/seed.js >/dev/null
PHOTOS="$(curl -fsS "$BASE/api/photos" | json 'd.length')"
[[ "$PHOTOS" -gt 0 ]] || fail "no photos after seeding"

step "admin login"
curl -fsS -c "$JAR" -H 'x-admin-request: 1' -H 'content-type: application/json' \
  -d "{\"username\":\"smoke\",\"password\":\"$PASSWORD\"}" "$BASE/api/admin/login" >/dev/null || fail "login"
[[ "$(curl -fsS -b "$JAR" "$BASE/api/admin/session" | json 'd.authenticated')" == "true" ]] || fail "session"

step "create a project with an uploaded cover"
node -e "
const zlib=require('zlib');const w=800,h=500;const raw=Buffer.alloc((w*3+1)*h);
for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++){const o=y*(w*3+1)+1+x*3;raw[o]=x%256;raw[o+1]=y%256;raw[o+2]=128;}}
const crc=(b)=>{let c=~0;for(const x of b){c^=x;for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return ~c>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
require('fs').writeFileSync(process.argv[1],Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
" "$WORK/cover.png"
PROJECT_ID="$(curl -fsS -b "$JAR" -H 'x-admin-request: 1' -H 'content-type: application/json' \
  -d '{"title":{"en":"Smoke"},"slug":"smoke"}' "$BASE/api/admin/projects" | json 'd.project.id')"
curl -fsS -b "$JAR" -H 'x-admin-request: 1' -F "file=@$WORK/cover.png;type=image/png" \
  "$BASE/api/admin/projects/$PROJECT_ID/images?slot=cover" >/dev/null || fail "cover upload"
curl -fsS -b "$JAR" -X PATCH -H 'x-admin-request: 1' -H 'content-type: application/json' \
  -d '{"visibility":"public"}' "$BASE/api/admin/projects/$PROJECT_ID" >/dev/null || fail "publish project"

check_project() {
  local cover
  cover="$(curl -fsS "$BASE/api/projects/smoke" | json 'd.cover.variants[0].url')" || fail "project missing"
  [[ "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$BASE$cover")" == "200 image/webp" ]] || fail "cover image $cover"
}
check_project

step "music player endpoint"
# Reaching Spotify is not required (the request answers within seconds either way).
[[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$BASE/api/spotify/player")" == "200" ]] || fail "spotify player"

step "restart and check that data survived"
compose down
compose up -d --wait --wait-timeout 180 || fail "stack did not come back"
check_project
[[ "$(curl -fsS "$BASE/api/photos" | json 'd.length')" == "$PHOTOS" ]] || fail "photos lost after restart"
compose exec -T -w /app/apps/api app node /app/node_modules/prisma/build/index.js migrate status >/dev/null || fail "migrations not up to date"

echo "Smoke test passed."
