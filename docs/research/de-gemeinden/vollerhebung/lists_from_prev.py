"""Listen-Zuordnung (Heimat-Info, meinOrt) aus der vorherigen Erhebung uebernehmen.
Beide sind Lizenzquellen; ihre Listen werden fuer die Wiederholung nicht neu geladen.

  python lists_from_prev.py <ordner> <vorherige vollerhebung.csv>
"""
import csv, json, sys

D, PREV = sys.argv[1], sys.argv[2]
rows = list(csv.DictReader(open(PREV, encoding="utf-8")))
out = {
    "heimatinfo": {r["ags"]: r["heimatinfo_id"] for r in rows if r.get("heimatinfo_id")},
    "meinort": {r["ags"]: r["meinort_ort"] or "1" for r in rows if r.get("meinort") == "1"},
    "meinort_mehrdeutig": [],
}
json.dump(out, open(f"{D}/list_matches.json", "w", encoding="utf-8"), ensure_ascii=False)
print("Heimat-Info", len(out["heimatinfo"]), "meinOrt", len(out["meinort"]))
