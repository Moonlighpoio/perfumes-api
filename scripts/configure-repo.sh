#!/usr/bin/env bash
#
# Configuración inicial del repositorio en GitHub (idempotente).
# Requiere: gh CLI autenticado con permisos de administrador sobre el repo.
#
# Uso:
#   gh auth login
#   REPO=Moonlighpoio/perfumes-api bash scripts/configure-repo.sh
#
# Opcional:
#   SNYK_TOKEN=xxxx REPO=Moonlighpoio/perfumes-api bash scripts/configure-repo.sh
#
set -euo pipefail

REPO="${REPO:-Moonlighpoio/perfumes-api}"
CHECKS='["Calidad y pruebas", "Seguridad", "Imagen Docker"]'

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: falta el CLI de GitHub (gh). Instálalo desde https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: ejecuta 'gh auth login' antes de continuar." >&2
  exit 1
fi

echo "==> Configurando repositorio ${REPO}"
gh repo edit "$REPO" \
  --description "Perfumes API - EP2 DevOps: CI/CD, Docker, seguridad y orquestación" \
  --add-topic devops \
  --add-topic ci-cd \
  --add-topic docker \
  --add-topic github-actions \
  --add-topic express \
  --add-topic nodejs

echo "==> Habilitando alertas de vulnerabilidades y Dependabot"
gh api -X PUT "repos/${REPO}/vulnerability-alerts" >/dev/null
gh api -X PUT "repos/${REPO}/automated-security-fixes" >/dev/null

echo "==> Permitiendo que GITHUB_TOKEN publique imágenes en GHCR"
gh api -X PUT "repos/${REPO}/actions/permissions/workflow" \
  -f default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=true >/dev/null

if [ -n "${SNYK_TOKEN:-}" ]; then
  echo "==> Guardando secreto SNYK_TOKEN"
  printf '%s' "${SNYK_TOKEN}" | gh secret set SNYK_TOKEN --repo "${REPO}" >/dev/null
else
  echo "AVISO: SNYK_TOKEN no fue entregado."
  echo "       Configúralo luego con: gh secret set SNYK_TOKEN --repo ${REPO}"
fi

echo "==> Creando environments staging y production"
for environment in staging production; do
  gh api -X PUT "repos/${REPO}/environments/${environment}" >/dev/null
done

protect_branch() {
  local branch="$1"

  if ! gh api "repos/${REPO}/branches/${branch}" >/dev/null 2>&1; then
    echo "AVISO: la rama ${branch} no existe; se omite su protección."
    return
  fi

  echo "==> Protegiendo rama ${branch}"
  gh api -X PUT "repos/${REPO}/branches/${branch}/protection" --input - >/dev/null <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ${CHECKS}
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
}

protect_branch develop
protect_branch main

echo
echo "Configuración completada."
echo "Recuerda: para exigir 1 aprobación, cambia 'required_approving_review_count' a 1"
echo "en la protección de ramas (Settings > Branches) o edita este script."
