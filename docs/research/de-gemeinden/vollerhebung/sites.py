"""Eingang der Vollerhebung: je Gemeinde (Destatis, data/gemeinden-de.json) die
offizielle Website und die ihres Verbands aus Wikidata (P439 Gemeindeschluessel bzw.
P1388 Regionalschluessel, P856 Website). Ausgabe: gemeinden_sites.csv und hosts.tsv
(Host, URL) fuer detect.py. Ein Abruf je Abfrage, nur lesend.

  python sites.py <ordner> [<vorherige vollerhebung.csv>] [Gemeinden-Limit, nur Probelauf]

Ohne Wikidata-Treffer gilt der Host der vorherigen Erhebung (Spalte host), damit
eine Gemeinde nicht nur wegen einer Wikidata-Luecke aus der Erhebung faellt.
"""
import csv, json, os, sys, time, urllib.parse
import requests

sys.stdout.reconfigure(encoding="utf-8")
UA = "lasstreffen-research/1.0 (+https://lasstreffen.at; Vollerhebung DE)"
WDQS = "https://query.wikidata.org/sparql"
LAND = {"schleswig-holstein": "SH", "hamburg": "HH", "niedersachsen": "NI", "bremen": "HB",
        "nordrhein-westfalen": "NW", "hessen": "HE", "rheinland-pfalz": "RP", "baden-wuerttemberg": "BW",
        "bayern": "BY", "saarland": "SL", "berlin": "BE", "brandenburg": "BB", "mecklenburg-vorpommern": "MV",
        "sachsen": "SN", "sachsen-anhalt": "ST", "thueringen": "TH"}


def sparql(prop):
    q = f"SELECT ?key ?site WHERE {{ ?item wdt:{prop} ?key; wdt:P856 ?site. FILTER NOT EXISTS {{ ?item wdt:P576 ?end }} }}"
    r = requests.get(WDQS, params={"query": q, "format": "json"}, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"}, timeout=300)
    r.raise_for_status()
    out = {}
    for b in r.json()["results"]["bindings"]:
        out.setdefault(b["key"]["value"], b["site"]["value"])
    return out


def host(u):
    return urllib.parse.urlsplit(u).netloc.lower().removeprefix("www.") if u else ""


if __name__ == "__main__":
    D = sys.argv[1]
    os.makedirs(D, exist_ok=True)
    root = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
    gem = json.load(open(os.path.join(root, "data", "gemeinden-de.json"), encoding="utf-8"))
    if len(sys.argv) > 3 and sys.argv[3]:
        gem = gem[: int(sys.argv[3])]
    prev = {}
    if len(sys.argv) > 2:
        prev = {r["ags"]: r for r in csv.DictReader(open(sys.argv[2], encoding="utf-8"))}
    by_ags = sparql("P439")
    time.sleep(5)
    by_rs = sparql("P1388")
    rows, hosts, fallback = [], {}, 0
    for g in gem:
        site = by_ags.get(g["ags"]) or by_rs.get(g["ars"]) or ""
        if not site and prev.get(g["ags"], {}).get("host"):
            site, fallback = "https://" + prev[g["ags"]]["host"] + "/", fallback + 1
        # Verband (Amt, VG, Samtgemeinde): Regionalschluessel = Verbandsschluessel + "000".
        vbsite = by_rs.get(g["verbandKey"] + "000", "") if g.get("verbandKey") else ""
        rows.append({"ags": g["ags"], "land": LAND[g["land"]], "name": g.get("nameAmtlich") or g["name"],
                     "ew": g.get("einwohner") or "", "kreis": g.get("kreis") or "", "vb": g.get("verband") or g.get("nameAmtlich") or g["name"],
                     "site": site, "vbsite": vbsite})
        for u in (site, vbsite):
            if host(u): hosts.setdefault(host(u), u)
    with open(f"{D}/gemeinden_sites.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    with open(f"{D}/hosts.tsv", "w", encoding="utf-8") as f:
        for h, u in sorted(hosts.items()): f.write(f"{h}\t{u}\n")
    print("Gemeinden", len(rows), "mit Website", sum(1 for r in rows if r["site"]), "davon aus der Vorerhebung", fallback,
          "mit Verbandsseite", sum(1 for r in rows if r["vbsite"]), "Hosts", len(hosts))
