#!/usr/bin/env bash
# Deploys the vault's Edge Functions to ONE vault project, sets its
# submission secret, and checks the functions refuse what they must.
#
#   npx supabase login                       # once, on your own machine
#   scripts/vault-deploy.sh <project-ref>    # dev vault first, then production
#   scripts/vault-deploy.sh <project-ref> --dry-run   # print, change nothing
#
# Run by the vault owner only. Nothing here is read from or written to the
# repository, Vercel or any file: the secret it generates is printed once, for
# your password manager, and stored in the vault's function secrets.
#
# Why it stages the functions first: they live in supabase/vault/functions,
# but the Supabase CLI deploys from <workdir>/supabase/functions. They are
# copied, with _shared, into a temporary directory laid out that way.
#
# Why four functions are deployed with --no-verify-jwt: core calls
# submit-documents, seal-document, seal-feedback and submit-bank with the shared
# x-core-signature header, not a vault login. Supabase's gateway rejects a
# call without a valid vault JWT before it reaches the code, so those four
# check the signature themselves. read-salary, read-feedback and approve-bank
# keep the gateway check: only a signed-in vault user may call them.
set -euo pipefail

REF="${1:-}"
DRY_RUN=""
[ "${2:-}" = "--dry-run" ] && DRY_RUN=1

if ! [[ "$REF" =~ ^[a-z]{20}$ ]]; then
  echo "Usage: $0 <vault project ref> [--dry-run]" >&2
  echo "The ref is the 20 lowercase letters in the vault's URL: https://<ref>.supabase.co" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPABASE="npx -y supabase@2.20.12"
URL="https://${REF}.supabase.co"
SIGNED_IN_ONLY=(read-salary read-feedback approve-bank)
CALLED_BY_CORE=(submit-documents seal-document seal-feedback submit-bank)

run() {
  if [ -n "$DRY_RUN" ]; then printf '  would run: %s\n' "$*"; else "$@"; fi
}

echo "Vault: ${URL}"
if [ -z "$DRY_RUN" ]; then
  read -r -p "Deploy the vault functions to this project? Type the ref again to confirm: " again
  [ "$again" = "$REF" ] || { echo "Did not match. Nothing changed."; exit 1; }
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/supabase"
cp -R "$ROOT/supabase/vault/functions" "$STAGE/supabase/functions"
rm -f "$STAGE/supabase/functions/README.md"

echo "1. Deploying functions"
for fn in "${SIGNED_IN_ONLY[@]}"; do
  run $SUPABASE functions deploy "$fn" --project-ref "$REF" --workdir "$STAGE" --use-api
done
for fn in "${CALLED_BY_CORE[@]}"; do
  run $SUPABASE functions deploy "$fn" --project-ref "$REF" --workdir "$STAGE" --use-api --no-verify-jwt
done

echo "2. Submission secret"
if [ -n "$DRY_RUN" ]; then
  echo "  would generate a 64-character secret and run: supabase secrets set CORE_SUBMISSION_SECRET=… --project-ref $REF"
else
  read -r -p "Set a NEW CORE_SUBMISSION_SECRET? This breaks core's calls until Vercel has the same value. [y/N] " yn
  if [ "$yn" = "y" ] || [ "$yn" = "Y" ]; then
    SECRET="$(openssl rand -hex 32)"
    # Passed through a private file in the staging directory (removed on
    # exit), so it never appears in the process list or shell history.
    ENVFILE="$STAGE/secret.env"
    (umask 077; printf 'CORE_SUBMISSION_SECRET=%s\n' "$SECRET" > "$ENVFILE")
    $SUPABASE secrets set --project-ref "$REF" --env-file "$ENVFILE"
    rm -f "$ENVFILE"
    echo
    echo "  Saved in the vault. Copy it into your password manager now; it is not shown again:"
    echo
    echo "    $SECRET"
    echo
    echo "  It goes into Vercel only when you decide to connect core (Production only, Sensitive)."
    unset SECRET
  else
    echo "  Kept the existing secret."
  fi
fi

echo "3. Checking the functions refuse what they must"
check() {
  local label="$1" expect="$2"; shift 2
  if [ -n "$DRY_RUN" ]; then echo "  would check: $label (expect $expect)"; return; fi
  local got
  got="$(curl -s -o /dev/null -w '%{http_code}' "$@")"
  if [ "$got" = "$expect" ]; then echo "  ok    $label ($got)"; else echo "  FAIL  $label: expected $expect, got $got"; FAILED=1; fi
}
FAILED=""
check "read-salary with no vault login"         401 -X POST "$URL/functions/v1/read-salary" -H 'content-type: application/json' -d '{}'
check "read-feedback with no vault login"       401 -X POST "$URL/functions/v1/read-feedback" -H 'content-type: application/json' -d '{}'
check "seal-document without core's signature"  401 -X POST "$URL/functions/v1/seal-document"
check "seal-feedback without core's signature"  401 -X POST "$URL/functions/v1/seal-feedback" -H 'content-type: application/json' -d '{}'
check "submit-documents with a wrong signature" 401 -X POST "$URL/functions/v1/submit-documents" -H 'x-core-signature: not-the-secret'
check "submit-bank with a wrong signature"      401 -X POST "$URL/functions/v1/submit-bank" -H 'x-core-signature: not-the-secret'
check "approve-bank with no vault login"        401 -X POST "$URL/functions/v1/approve-bank" -H 'content-type: application/json' -d '{"action":"list"}'

if [ -n "$FAILED" ]; then
  echo "Some checks failed. Do not connect core until they pass." >&2
  exit 1
fi
echo "Done. Next: docs/vault-setup.md step 4 (turn sign-ups off, invite the vault users)."
