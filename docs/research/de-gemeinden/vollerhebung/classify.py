"""Jede Gemeinde genau einer Integration zuordnen (erste passende Stufe gewinnt)."""
import csv, json, sys, re, urllib.parse, collections
sys.stdout.reconfigure(encoding="utf-8")
D = sys.argv[1]
gem = list(csv.DictReader(open(f"{D}/gemeinden_sites.csv", encoding="utf-8")))
p1 = {json.loads(l)["host"]: json.loads(l) for l in open(f"{D}/detect.jsonl", encoding="utf-8")}
p2 = {json.loads(l)["host"]: json.loads(l) for l in open(f"{D}/detect2.jsonl", encoding="utf-8")}
p3 = {json.loads(l)["host"]: json.loads(l) for l in open(f"{D}/detect3.jsonl", encoding="utf-8")}
lm = json.load(open(f"{D}/list_matches.json", encoding="utf-8"))
HI, MO = set(lm["heimatinfo"]), set(lm["meinort"])

def hk(u):
    return urllib.parse.urlsplit(u).netloc.lower().removeprefix("www.") if u else ""

EMBED_IFR = re.compile(r"kalender\.digital|freizeitkalender|veranstaltungen-lech-wertach|veranstaltungen-im-norden|wintopevents|infomaxnet|imxplatform|dahoam-in|termine\.|kalender\.|kulturtermine|eventfrog|art-trier|styledcalendar")
# Stufen: (Name, Klasse, Test)
COMM = set()
for _f in ("detect.jsonl", "detect2.jsonl", "detect3.jsonl"):
    for _l in open(f"{D}/{_f}", encoding="utf-8"):
        if "communice" in _l.lower() or "inixmedia" in _l.lower(): COMM.add(json.loads(_l)["host"])

def feats(host):
    a, b = p1.get(host, {}), p2.get(host, {})
    m = set(a.get("markers", [])) | set(b.get("markers", []))
    if "ionas" in m and not re.search(r"ionas", " ".join(a.get("generator", []) + b.get("generator", [])), re.I):
        # Pass 1 hatte ein zu weites Muster; ionas nur, wenn Pass 2 (enges Muster) es bestaetigt
        if "ionas" not in set(b.get("markers", [])): m.discard("ionas")
    gen = " ".join(a.get("generator", []) + b.get("generator", []))
    ext = set(a.get("ext_hosts", [])) | set(b.get("scripts", []))
    if host in COMM: m.add("communice")
    if "cEasy" in gen: m.add("ceasy")
    if "Weblication" in gen: m.add("weblication")
    if "Open2C" in gen: m.add("open2c")
    if "GeoCMS" in gen: m.add("geocms")
    if "contentXXL" in gen: m.add("contentxxl")
    if any("lkrg.net" in h for h in ext): m.add("lkrg")
    if any(EMBED_IFR.search(h) for h in b.get("iframes", [])): m.add("embed_other")
    return m, a, b

ORDER = [
    ("heimatinfo", "A API/Feed"), ("cross7", "A API/Feed"), ("nolis", "A API/Feed"),
    ("tribe", "A API/Feed"), ("mec", "A API/Feed"), ("eventsmanager", "A API/Feed"),
    ("jevents", "A API/Feed"), ("ionas", "A API/Feed"), ("communice", "A API/Feed"), ("icagenda", "A API/Feed"), ("dpcalendar", "A API/Feed"), ("komm1", "A API/Feed"),
    ("verwaltungsportal", "B Hersteller-HTML"), ("ikiss", "B Hersteller-HTML"),
    ("hwext", "B Hersteller-HTML"), ("ceasy", "B Hersteller-HTML"), ("activecity", "B Hersteller-HTML"),
    ("weblication", "B Hersteller-HTML"), ("open2c", "B Hersteller-HTML"), ("geocms", "B Hersteller-HTML"),
    ("contentxxl", "B Hersteller-HTML"), ("sitepark", "B Hersteller-HTML"), ("digipublica", "B Hersteller-HTML"),
    ("cmcitymedia", "B Hersteller-HTML"), ("townhall", "B Hersteller-HTML"), ("calendarize", "B Hersteller-HTML"),
    ("events2", "B Hersteller-HTML"), ("sfeventmgt", "B Hersteller-HTML"), ("txnews", "B Hersteller-HTML"),
    ("contao_events", "B Hersteller-HTML"), ("eventon", "B Hersteller-HTML"),
    ("destinationone", "C eingebettet"), ("deskline", "C eingebettet"), ("rce", "C eingebettet"),
    ("toubiz", "C eingebettet"), ("regiogate", "C eingebettet"), ("termineregional", "C eingebettet"),
    ("lkrg", "C eingebettet"), ("outdooractive", "C eingebettet"), ("embed_other", "C eingebettet"),
    ("crossiety", "C eingebettet"), ("stadtlandnews", "C eingebettet"),
]

def host_class(host, extra=()):
    m, a, b = feats(host)
    m |= set(extra)
    c3 = p3.get(host, {})
    if c3.get("status") == 200:
        m |= set(c3.get("markers", []))
    reach = a.get("status") == 200 or c3.get("status") == 200
    if not reach:
        return ("G nicht erreichbar", "robots" if a.get("robots_blocked") else "fehler"), m, b
    for name, c in ORDER:
        if name in m:
            return (c, name), m, b
    if b.get("ld_events", 0) > 0 or b.get("micro", 0) > 0 or c3.get("ld_events", 0) > 0:
        return ("D JSON-LD/Mikrodaten", "jsonld"), m, b
    if (b.get("status") == 200 and b.get("dates", 0) >= 5) or c3.get("dates2", 0) >= 3:
        return ("E Kalender, Technik offen", "html_generic"), m, b
    if c3.get("status") == 200 and (c3.get("jscal") or c3.get("feeds")):
        return ("E Kalender, Technik offen", "js_oder_feed"), m, b
    if b.get("status") == 200 or c3.get("status") == 200:
        return ("F Seite ohne Termine", "leer"), m, b
    return ("F kein Kalenderlink", "kein_link"), m, b

rows = []
for g in gem:
    host = hk(g["site"]) or hk(g["vbsite"])
    (cls, integ), m, b = host_class(host, ("heimatinfo",) if g["ags"] in HI else ())
    vbh = hk(g["vbsite"])
    vb_cls, vb_int = "", ""
    if cls[0] in "FG" and vbh and vbh != host:
        (vb_cls, vb_int), _, _ = host_class(vbh)
    rows.append({**{k: g[k] for k in ("ags", "land", "name", "ew", "kreis", "vb")}, "host": host,
                 "klasse": cls, "integration": integ, "vb_host": vbh if vb_cls else "", "vb_klasse": vb_cls, "vb_integration": vb_int,
                 "meinort": int(g["ags"] in MO),
                 "amtsblatt_wittich": int("wittich" in m), "amtsblatt_nussbaum": int("nussbaum" in m),
                 "event_url": b.get("event_url") or p3.get(host, {}).get("url", "") or "", "merkmale": " ".join(sorted(m))})

with open(f"{D}/gemeinden_klassifiziert.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

tot = len(rows)
print("Gemeinden", tot)
kc = collections.Counter(r["klasse"] for r in rows)
for k, n in sorted(kc.items()): print(f"{k:28s} {n:6d}  {n/tot:5.1%}")
print("\nIntegrationen (Gemeinden):")
for k, n in collections.Counter(r["integration"] for r in rows).most_common(): print(f"  {k:20s} {n}")
print("\nF/G mit meinOrt:", sum(1 for r in rows if r["klasse"][0] in "FG" and r["meinort"]),
      " F/G mit Wittich-Amtsblattlink:", sum(1 for r in rows if r["klasse"][0] in "FG" and r["amtsblatt_wittich"]))
print("meinOrt gesamt:", sum(r["meinort"] for r in rows), " davon zusaetzlich zu A-E:", sum(1 for r in rows if r["meinort"] and r["klasse"][0] in "FG"))
lands = sorted({r["land"] for r in rows}, key=lambda l: -sum(1 for r in rows if r["land"] == l))
print("\nLand  n     A     B     C     D     E     F     G   +meinOrt(F/G)")
for l in lands:
    rr = [r for r in rows if r["land"] == l]
    c = collections.Counter(r["klasse"][0] for r in rr)
    print(f"{l:4s} {len(rr):5d} " + " ".join(f"{c.get(x,0):5d}" for x in "ABCDEFG") + f"   {sum(1 for r in rr if r['meinort'] and r['klasse'][0] in 'FG'):5d}")
