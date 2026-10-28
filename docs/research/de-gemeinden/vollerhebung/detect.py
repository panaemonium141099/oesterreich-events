"""Einmaliger Startseiten-Abruf je Gemeinde-Host: robots.txt pruefen, Startseite holen,
nur Merkmale speichern (kein HTML). Ausgabe: JSONL, fortsetzbar."""
import sys, json, re, os, threading, urllib.parse, urllib.robotparser
from concurrent.futures import ThreadPoolExecutor
import requests

UA = "Mozilla/5.0 (compatible; lasstreffen-research/1.0; einmaliger Startseitenabruf)"
MARKERS = {
    "cross7": r"components\.cross-7\.de|data-c7-page",
    "heimatinfo": r"heimat-info\.de|events_heimatinfo",
    "nolis": r"NOLIS GmbH|nol-is\.de",
    "ikiss": r"Advantic GmbH|data-ikiss-mfid|/output/js/ikiss/",
    "komm1": r"dvv-Mastertemplates",
    "verwaltungsportal": r"verwaltungsportal\.de",
    "tribe": r"plugins/the-events-calendar|tribe-events",
    "mec": r"modern-events-calendar",
    "eventsmanager": r"plugins/events-manager/",
    "eventon": r"plugins/eventON/",
    "jevents": r"com_jevents",
    "icagenda": r"com_icagenda",
    "dpcalendar": r"com_dpcalendar",
    "deskline": r"deskline\.net|feratel",
    "destinationone": r"et4\.de|destination\.one|et4pro",
    "activecity": r"Generated with active-City|spectaculum",
    "calendarize": r"calendarize",
    "txnews": r"tx_news_pi1",
    "events2": r"tx_events2",
    "sfeventmgt": r"tx_sfeventmgt",
    "contao_events": r"mod_eventlist",
    "townhall": r"plugins/townhall|cosmema",
    "meinort": r"meinort\.(de|app)",
    "wittich": r"wittich\.de",
    "nussbaum": r"nussbaum\.de|lokalmatador",
    "rce": r"rce-event",
    "regiogate": r"regiogate",
    "termineregional": r"termine-regional\.de",
    "toubiz": r"toubiz",
    "outdooractive": r"outdooractive",
    "guidle": r"guidle",
    "eventfrog": r"eventfrog",
    "crossiety": r"crossiety",
    "stadtlandnews": r"stadtlandnews|digitale-doerfer|dorfpages",
    "cmcitymedia": r"cmcitymedia|cm city media",
    "komuna": r"komuna",
    "digipublica": r"digipublica",
    "ionas": r"ionas",
    "hwext": r"hwveranstaltung|hwdatenschutz",
    "smartvillage": r"smart-village",
    "gem2go": r"gem2go",
    "rim_ekom21": r"rim\.ekom21\.de",
    "sitepark": r"sitepark|infosite",
    "iris": r"\biris\b",
}
MRE = {k: re.compile(v, re.I) for k, v in MARKERS.items()}
GEN = re.compile(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)', re.I)
GEN2 = re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']generator', re.I)
SRC = re.compile(r'(?:src|href)=["\'](https?:)?//([^/"\'\s>]+)', re.I)
HREF = re.compile(r'href=["\']([^"\'#]+)["\'][^>]*>([^<]{0,80})', re.I)
EVW = re.compile(r"veranstalt|termin|kalender|event|aktuelles", re.I)
FEED = re.compile(r'<link[^>]+type=["\'](application/(?:rss|atom)\+xml|text/calendar)["\'][^>]*>', re.I)
TITLE = re.compile(r"<title[^>]*>([^<]{0,200})", re.I)
DESIGNER = re.compile(r'<meta[^>]+name=["\'](?:author|designer|publisher)["\'][^>]+content=["\']([^"\']{0,120})', re.I)
COMMENT = re.compile(r"<!--\s*([^<>]{0,120}?(?:powered|generated|realisiert|cms|design)[^<>]{0,80}?)-->", re.I)

def fetch_robots(base):
    rp = urllib.robotparser.RobotFileParser()
    try:
        r = requests.get(base + "/robots.txt", headers={"User-Agent": UA}, timeout=15)
        if r.status_code >= 400:
            rp.parse([])
        else:
            rp.parse(r.text.splitlines())
    except Exception:
        rp.parse([])
    return rp

def work(item):
    host, url = item
    rec = {"host": host, "url": url}
    try:
        p = urllib.parse.urlsplit(url if "://" in url else "https://" + url)
        base = f"{p.scheme or 'https'}://{p.netloc}"
        rp = fetch_robots(base)
        if not rp.can_fetch(UA, url):
            rec["robots_blocked"] = True
        else:
            r = requests.get(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "de"}, timeout=20, stream=True)
            body = b""
            for chunk in r.iter_content(65536):
                body += chunk
                if len(body) > 3_000_000: break
            r.close()
            enc = r.encoding if r.encoding and r.encoding.lower() != "iso-8859-1" else None
            t = body.decode(enc or "utf-8", errors="replace")
            rec.update(status=r.status_code, final=r.url, size=len(body))
            rec["markers"] = sorted(k for k, rx in MRE.items() if rx.search(t))
            g = GEN.findall(t) + GEN2.findall(t)
            rec["generator"] = g[:3]
            rec["designer"] = DESIGNER.findall(t)[:3]
            rec["comments"] = [c.strip() for c in COMMENT.findall(t)][:3]
            hosts = {h.lower() for _, h in SRC.findall(t)}
            fh = urllib.parse.urlsplit(r.url).netloc.lower()
            rec["ext_hosts"] = sorted(h for h in hosts if h != fh)[:60]
            rec["feeds"] = FEED.findall(t)[:5]
            ev = []
            for h, txt in HREF.findall(t):
                if EVW.search(h) or EVW.search(txt):
                    ev.append(h[:200])
            rec["event_links"] = list(dict.fromkeys(ev))[:15]
            tt = TITLE.findall(t)
            rec["title"] = tt[0].strip() if tt else ""
    except Exception as e:
        rec["error"] = type(e).__name__ + ": " + str(e)[:120]
    with lock:
        out.write(json.dumps(rec, ensure_ascii=False) + "\n"); out.flush()

if __name__ == "__main__":
    HOSTS, OUT = sys.argv[1], sys.argv[2]
    done = set()
    if os.path.exists(OUT):
        for line in open(OUT, encoding="utf-8"):
            try: done.add(json.loads(line)["host"])
            except Exception: pass
    lock = threading.Lock()
    out = open(OUT, "a", encoding="utf-8")
    
    items = []
    for line in open(HOSTS, encoding="utf-8"):
        h, u = line.rstrip("\n").split("\t")
        if h not in done: items.append((h, u))
    print("todo", len(items), flush=True)
    with ThreadPoolExecutor(int(sys.argv[3]) if len(sys.argv) > 3 else 40) as ex:
        list(ex.map(work, items))
    print("fertig", flush=True)
