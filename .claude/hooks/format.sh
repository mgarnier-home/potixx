#!/usr/bin/env bash
# Hook PostToolUse (Edit|Write) : formate avec Prettier le fichier que Claude vient de modifier.
# Ne bloque jamais : toute erreur est ignorée.
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
file=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{}})')
[ -n "$file" ] && [ -f "$file" ] && npx --no-install prettier --write --ignore-unknown "$file" >/dev/null 2>&1
exit 0
