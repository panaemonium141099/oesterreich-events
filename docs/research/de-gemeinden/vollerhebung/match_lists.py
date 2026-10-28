"""meinOrt-Ortsliste und Heimat-Info-Kommunen auf AGS abbilden."""
import csv, json, re, sys, math, collections, unicodedata
sys.stdout.reconfigure(encoding="utf-8")
D = sys.argv[1]
gem = list(csv.DictReader(open(f"{D}/gemeinden_sites.csv", encoding="utf-8")))

def norm(s):
    s = s.split(",")[0]
    s = re.sub(r"\(.*?\)", " ", s)
    s = s.lower().replace("ß", "ss").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"\b(st\.|sankt)\s*", "st ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return s

by_name = collections.defaultdict(list)
for g in gem:
    by_name[norm(g["name"])].append(g)
    # Varianten ohne Zusatz wie "a.d.Aisch" nicht noetig, Basisname reicht fuer eindeutige Faelle
    base = norm(g["name"]).split(" ")[0] if " " in norm(g["name"]) else None

def dist(a, b):
    try:
        la1, lo1, la2, lo2 = map(float, (a[0], a[1], b[0], b[1]))
    except Exception:
        return 1e9
    return math.hypot((la1 - la2) * 111, (lo1 - lo2) * 71)

# Heimat-Info
hi = json.load(open(f"{D}/dl/heimatinfo_communes.json", encoding="utf-8"))
hi_res = collections.Counter(); hi_ags = {}
for c in hi:
    if c.get("parentCommuneId"):
        hi_res["unter"] += 1; continue
    cands = by_name.get(norm(c["name"]), [])
    pos = (c.get("latitude"), c.get("longitude"))
    hit = None
    if len(cands) == 1:
        hit = cands[0]
    elif len(cands) > 1:
        hit = min(cands, key=lambda g: dist(pos, (g["lat"], g["lon"])))
    else:
        near = sorted(gem, key=lambda g: dist(pos, (g["lat"], g["lon"])))[:3]
        if near and dist(pos, (near[0]["lat"], near[0]["lon"])) < 4:
            hit = near[0]; hi_res["nur_koordinate"] += 1
    if hit:
        hi_ags[hit["ags"]] = c["id"]; hi_res["treffer"] += 1
    else:
        hi_res["kein_treffer"] += 1
print("Heimat-Info", dict(hi_res), "eindeutige AGS", len(hi_ags))

# meinOrt
html = open(f"{D}/dl/meinort_orte.html", encoding="utf-8", errors="replace").read()
orte = sorted(set(re.findall(r'href="/(\d+)-([^"/?]+)"', html)))
mo_res = collections.Counter(); mo_ags = {}; amb = []
WITTICH = {"RP", "SL", "HE", "BY", "BB", "SN", "ST", "TH", "MV", "SH", "NI"}
for oid, slug in orte:
    name = slug.replace("-", " ")
    cands = by_name.get(norm(slug), []) or by_name.get(norm(name), [])
    if not cands:
        # "Kobern-Gondorf" bleibt mit Bindestrich in Destatis, norm macht beides gleich
        mo_res["kein_treffer"] += 1; continue
    if len(cands) == 1:
        mo_ags[cands[0]["ags"]] = f"{oid}-{slug}"; mo_res["eindeutig"] += 1
    else:
        mo_res["mehrdeutig"] += 1; amb.append((slug, [g["land"] for g in cands]))
print("meinOrt", len(orte), dict(mo_res), "eindeutige AGS", len(mo_ags))
print("mehrdeutig Beispiele", amb[:8])
json.dump({"heimatinfo": hi_ags, "meinort": mo_ags, "meinort_mehrdeutig": amb}, open(f"{D}/list_matches.json", "w", encoding="utf-8"), ensure_ascii=False)
lc = collections.Counter(g["land"] for g in gem if g["ags"] in mo_ags)
lh = collections.Counter(g["land"] for g in gem if g["ags"] in hi_ags)
print("meinOrt je Land", lc.most_common())
print("Heimat-Info je Land", lh.most_common())
