#!/usr/bin/env bash
# ==============================================================================
# MAChip: Standalone Agent & Skills Installer for Linux / Workstation
# Installs only the 16 curated skills and rules without needing files from Windows.
#
# Usage:
#   bash scripts/setup-agents.sh           # Installs locally into .agent/skills
#   bash scripts/setup-agents.sh --global  # Installs globally for agy into ~/.gemini/antigravity-cli/skills
# ==============================================================================

set -euo pipefail

MODE="local"
if [[ "${1:-}" == "--global" ]]; then
    MODE="global"
fi

TMP_DIR=$(mktemp -d -t machip-skills-XXXXXX)
trap 'rm -rf "${TMP_DIR}"' EXIT

if [[ "${MODE}" == "global" ]]; then
    TARGET_DIR="${HOME}/.gemini/antigravity-cli/skills"
    echo "Installing MAChip skills GLOBALLY into: ${TARGET_DIR}"
else
    TARGET_DIR=".agent/skills"
    echo "Installing MAChip skills LOCALLY into: ${TARGET_DIR}"
fi

mkdir -p "${TARGET_DIR}"

echo "Fetching upstream skill repositories into temporary directory..."
git clone --depth 1 https://github.com/mattpocock/skills.git "${TMP_DIR}/mattpocock" --quiet
git clone --depth 1 https://github.com/obra/superpowers.git "${TMP_DIR}/superpowers" --quiet
git clone --depth 1 https://github.com/wshobson/agents.git "${TMP_DIR}/wshobson" --quiet
git clone --depth 1 https://github.com/trailofbits/skills.git "${TMP_DIR}/trailofbits" --quiet
git clone --depth 1 https://github.com/anthropics/skills.git "${TMP_DIR}/anthropics" --quiet

echo "Copying curated 16 skills into ${TARGET_DIR}..."

# 1. mattpocock/skills (productivity & engineering)
cp -r "${TMP_DIR}/mattpocock/skills/productivity/grill-me" "${TARGET_DIR}/"
cp -r "${TMP_DIR}/mattpocock/skills/productivity/grilling" "${TARGET_DIR}/"
cp -r "${TMP_DIR}/mattpocock/skills/productivity/handoff" "${TARGET_DIR}/"
cp -r "${TMP_DIR}/mattpocock/skills/engineering/grill-with-docs" "${TARGET_DIR}/"
cp -r "${TMP_DIR}/mattpocock/skills/engineering/domain-modeling" "${TARGET_DIR}/"
cp -r "${TMP_DIR}/mattpocock/skills/engineering/to-spec" "${TARGET_DIR}/"
cp -r "${TMP_DIR}/mattpocock/skills/engineering/to-tickets" "${TARGET_DIR}/"
cp -r "${TMP_DIR}/mattpocock/skills/engineering/tdd" "${TARGET_DIR}/"
cp -r "${TMP_DIR}/mattpocock/skills/engineering/code-review" "${TARGET_DIR}/"
cp -r "${TMP_DIR}/mattpocock/skills/engineering/research" "${TARGET_DIR}/"
cp -r "${TMP_DIR}/mattpocock/skills/engineering/diagnosing-bugs" "${TARGET_DIR}/"

# 2. obra/superpowers
cp -r "${TMP_DIR}/superpowers/skills/using-git-worktrees" "${TARGET_DIR}/"

# 3. wshobson/agents
cp -r "${TMP_DIR}/wshobson/plugins/javascript-typescript/skills/nodejs-backend-patterns" "${TARGET_DIR}/"
cp -r "${TMP_DIR}/wshobson/plugins/database-design/skills/postgresql-table-design" "${TARGET_DIR}/"

# 4. trailofbits/skills
cp -r "${TMP_DIR}/trailofbits/plugins/differential-review/skills/differential-review" "${TARGET_DIR}/"

# 5. anthropics/skills
cp -r "${TMP_DIR}/anthropics/skills/skills/webapp-testing" "${TARGET_DIR}/"

# Record manifest
MATT_SHA=$(git -C "${TMP_DIR}/mattpocock" rev-parse --short HEAD)
OBRA_SHA=$(git -C "${TMP_DIR}/superpowers" rev-parse --short HEAD)
WSHOB_SHA=$(git -C "${TMP_DIR}/wshobson" rev-parse --short HEAD)
TOB_SHA=$(git -C "${TMP_DIR}/trailofbits" rev-parse --short HEAD)
ANTH_SHA=$(git -C "${TMP_DIR}/anthropics" rev-parse --short HEAD)

cat <<EOF > "${TARGET_DIR}/SKILLS_MANIFEST.md"
# MAChip: Installed Skills Manifest (Linux)
- Installed: $(date -u +"%Y-%m-%d %H:%M:%SZ")
- Total Skills: 16
- Sources:
  * mattpocock/skills @ ${MATT_SHA}
  * obra/superpowers @ ${OBRA_SHA}
  * wshobson/agents @ ${WSHOB_SHA}
  * trailofbits/skills @ ${TOB_SHA}
  * anthropics/skills @ ${ANTH_SHA}
EOF

# For local project installs, ensure .agents alias exists
if [[ "${MODE}" == "local" ]]; then
    if [[ ! -e ".agents" ]]; then
        ln -s .agent .agents
    fi
fi

echo ""
echo "=== Setup Complete ==="
echo "Skills installed: $(find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 -type d | wc -l)"
find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \;
echo "Done! All agents and skills are ready on this machine."
