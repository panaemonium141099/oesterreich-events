#!/usr/bin/env bash
# Vollerhebung DE, ein Durchgang (Quartalslauf, .github/workflows/vollerhebung-de.yml).
#   bash run.sh <ordner> <vorherige vollerhebung.csv> [Gemeinden-Limit]
# Gemeinden-Limit nur fuer Probelaeufe (erste N Gemeinden). Je Server-IP nacheinander,
# hoechstens ein Abruf alle 3 s (drossel.py), bis zu 100 Server parallel; robots.txt je Host.
set -euo pipefail
D="$1"; PREV="$2"; LIMIT="${3:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$D"
python "$HERE/sites.py" "$D" "$PREV" "$LIMIT"
python "$HERE/detect.py" "$D/hosts.tsv" "$D/detect.jsonl"
python "$HERE/detect2.py" "$D/hosts.tsv" "$D/detect.jsonl" "$D/detect2.jsonl"
python "$HERE/lists_from_prev.py" "$D" "$PREV"
: > "$D/detect3.jsonl"
python "$HERE/classify.py" "$D" > /dev/null
python "$HERE/detect3.py" "$D" "$D/detect3.jsonl"
python "$HERE/classify.py" "$D" > "$D/classify.txt"
python "$HERE/diff.py" "$PREV" "$D/vollerhebung.csv" > "$D/diff.md"
