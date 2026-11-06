#!/usr/bin/env bash
# Baut das App-Image dort, wo dieses Skript läuft (GitHub-Runner, deploy.yml),
# statt auf dem Server neben der Datenbank. Bis 2026-11 baute deploy.sh auf dem
# Hetzner-Server; während der Typprüfung liefen Abfragen der Nachtläufe in den
# Statement-Timeout und api.lasstreffen.at war zeitweise nicht erreichbar
# (MASTERPLAN §3.15).
#
# Aufruf: scripts/deploy/build-image.sh <env-datei> [image-tag]
#
# <env-datei> ist die Laufzeit-Env des Servers (/opt/app/.env.master). Sie
# liefert die NEXT_PUBLIC_*-Werte für das Client-Bundle (als Build-Args, die
# Namen stehen im Dockerfile) und die Schlüssel für das Vorrendern (als
# BuildKit-Secret, nur während `npm run build` eingeblendet). Das Skript gibt
# keinen Wert aus, nur Namen.
set -euo pipefail

env_file=${1:?Aufruf: build-image.sh <env-datei> [image-tag]}
tag=${2:-lasstreffen-app:latest}

[ -s "$env_file" ] || { echo "Build-Env fehlt oder ist leer: $env_file" >&2; exit 1; }

build_args=()
empty=()
while read -r name; do
  value=$(sed -n "s/^${name}=//p" "$env_file" | tail -n 1 | tr -d '\r')
  value=${value#[\"\']}
  value=${value%[\"\']}
  [ -n "$value" ] || empty+=("$name")
  build_args+=(--build-arg "${name}=${value}")
done < <(sed -n 's/^ARG \(NEXT_PUBLIC_[A-Z0-9_]*\).*/\1/p' Dockerfile | sort -u)

echo "Build-Args: $((${#build_args[@]} / 2)) aus dem Dockerfile, ohne Wert: ${empty[*]:-keiner}"

# --provenance=false: die Herkunftsangabe würde die Build-Args mitschreiben,
# und `docker save` soll ein einzelnes Image liefern, keinen Index.
docker buildx build \
  --provenance=false \
  --secret "id=buildenv,src=${env_file}" \
  "${build_args[@]}" \
  --tag "$tag" \
  --load \
  .

# Die Env-Datei darf nur während des Builds sichtbar sein, nie im Image.
files=$(docker run --rm --entrypoint sh "$tag" -c 'ls -A /app')
if grep -q '\.local$' <<<"$files"; then
  echo "Im Image liegt eine .local-Env-Datei, Abbruch." >&2
  exit 1
fi

docker image inspect "$tag" --format 'Image {{index .RepoTags 0}}: {{.Size}} Bytes'
