#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${ROOT}/build"
STAGE_DIR="${OUT_DIR}/agnome@zam"
PROJECT_VERSION="0.1.0"
ZIP_PATH="${OUT_DIR}/agnome-${PROJECT_VERSION}.zip"

rm -rf "${STAGE_DIR}" "${ZIP_PATH}"
mkdir -p "${STAGE_DIR}/helpers" "${STAGE_DIR}/icons" "${STAGE_DIR}/schemas"

cp "${ROOT}/extension.js" "${STAGE_DIR}/"
cp "${ROOT}/prefs.js" "${STAGE_DIR}/"
cp "${ROOT}/metadata.json" "${STAGE_DIR}/"
cp "${ROOT}/stylesheet.css" "${STAGE_DIR}/"
cp "${ROOT}/README.md" "${STAGE_DIR}/"
cp "${ROOT}/LICENSE" "${STAGE_DIR}/"
cp "${ROOT}/helpers/pick-folder.js" "${STAGE_DIR}/helpers/"
cp "${ROOT}/icons/agnome-symbolic.svg" "${STAGE_DIR}/icons/"
cp "${ROOT}/schemas/org.gnome.shell.extensions.agnome.gschema.xml" "${STAGE_DIR}/schemas/"

bsdtar -a -cf "${ZIP_PATH}" \
    -C "${STAGE_DIR}" \
    extension.js prefs.js metadata.json stylesheet.css README.md LICENSE \
    helpers icons schemas

printf 'Created %s\n' "${ZIP_PATH}"
