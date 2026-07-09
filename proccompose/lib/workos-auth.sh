# WorkOS auth: get a service-to-service access token.
# Uses PHENOTYPE_SOPS_SECRETS or SOPS_AGE_KEY_FILE if WorkOS creds aren't set.
# Falls back to dev mode (local no-auth) if neither is available.

WORKOS_API_KEY="${WORKOS_API_KEY:-}"
WORKOS_CLIENT_ID="${WORKOS_CLIENT_ID:-}"

workos_token() {
  if [[ -z "$WORKOS_API_KEY" ]]; then
    # No WorkOS configured - use local dev mode
    echo "dev-mode-no-auth"
    return 0
  fi
  curl -fsS https://api.workos.com/user_management/authentication/sessions \
    -H "Authorization: Bearer $WORKOS_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"client_id\":\"$WORKOS_CLIENT_ID\",\"type\":\"service\"}" | jq -r .token
}

workos_authenticated() {
  local t
  t=$(workos_token)
  if [[ "$t" == "dev-mode-no-auth" ]]; then
    return 0
  fi
  [[ -n "$t" ]]
}
