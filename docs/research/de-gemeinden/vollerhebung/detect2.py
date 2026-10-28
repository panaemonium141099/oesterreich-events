"""Zweiter Durchgang: je Host die wahrscheinlichste Veranstaltungsseite einmal abrufen
(robots.txt beachten) und Kalendertechnik erkennen. Nur Merkmale, kein HTML."""
import sys, json, re, os, threading, urllib.parse, urllib.robotparser
from concurrent.futures import ThreadPoolExecutor
import requests
sys.path.insert(0, os.path.dirname(__file__))
from detect import MARKERS, UA  # noqa: E402  (laedt nur Konstanten)

MARKERS = dict(MARKERS)
MARKERS["ionas"] = r"ionasInfo|CMS ionas|ionas\.de"
MARKERS["iris"] = r"iris-[a-z]|/iris/"
MRE = {k: re.compile(v, re.I) for k, v in MARKERS.items()}
IFR = re.compile(r'<iframe[^>]+src=["\'](?:https?:)?//([^/"\']+)([^"\']*)', re.I)
SCR = re.compile(r'<script[^>]+src=["\'](?:https?:)?//([^/"\']+)', re.I)
LDEV = re.compile(r'"@type"\s*:\s*"Event"')
VEVENT = re.compile(r'class=["\'][^"\']*\bvevent\b', re.I)
MICRO = re.compile(r'itemtype=["\']https?://schema\.org/Event', re.I)
DATE = re.compile(r"\b\d{1,2}\.\s?\d{1,2}\.\s?(?:20)?2[6-8]\b")
FEED = re.compile(r'href=["\']([^"\']*(?:\.ics|ical|icalendar|/feed/?|rss)[^"\']*)["\']', re.I)
GEN = re.compile(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)', re.I)
GOOD = re.compile(r"veranstalt|termin|kalender|event", re.I)
BAD = re.compile(r"\.(pdf|jpg|png|docx?)$|mailto:|tel:|abfall|muell|müll|sitzung|ratsinfo|ris\.|wahl|notar|ferien|sprechstund|oeffnungs|öffnungs|blutspend|schiedsamt|sperrmuell|termin-?vereinbar|terminbuch|online-?termin|bürgerbüro|buergerbuero", re.I)

def pick(r):
    base = r["final"]
    cands = []
    for h in r.get("event_links", []):
        if BAD.search(h) or not GOOD.search(h): continue
        u = urllib.parse.urljoin(base, h)
        if urllib.parse.urlsplit(u).scheme not in ("http", "https"): continue
        score = 0
        if re.search(r"veranstaltung", h, re.I): score += 4
        elif re.search(r"kalender|termine", h, re.I): score += 2
        if urllib.parse.urlsplit(u).netloc == urllib.parse.urlsplit(base).netloc: score += 1
        cands.append((score, -len(u), u))
    return max(cands)[2] if cands else None

def scan(t):
    return {
        "markers": sorted(k for k, rx in MRE.items() if rx.search(t)),
        "iframes": sorted({h.lower() for h, _ in IFR.findall(t)})[:10],
        "scripts": sorted({h.lower() for h in SCR.findall(t)})[:30],
        "ld_events": len(LDEV.findall(t)), "vevent": len(VEVENT.findall(t)), "micro": len(MICRO.findall(t)),
        "dates": len(DATE.findall(t)), "feeds": list(dict.fromkeys(FEED.findall(t)))[:6],
        "generator": GEN.findall(t)[:2],
    }

def work(r):
    rec = {"host": r["host"]}
    u = pick(r)
    rec["event_url"] = u
    if not u:
        rec["no_event_link"] = True
    else:
        try:
            p = urllib.parse.urlsplit(u)
            rp = urllib.robotparser.RobotFileParser()
            try:
                rr = requests.get(f"{p.scheme}://{p.netloc}/robots.txt", headers={"User-Agent": UA}, timeout=15)
                rp.parse([] if rr.status_code >= 400 else rr.text.splitlines())
            except Exception:
                rp.parse([])
            if not rp.can_fetch(UA, u):
                rec["robots_blocked"] = True
            else:
                resp = requests.get(u, headers={"User-Agent": UA, "Accept": "text/html", "Accept-Language": "de"}, timeout=20, stream=True)
                ct = resp.headers.get("content-type", "")
                body = b""
                if "html" in ct or not ct:
                    for c in resp.iter_content(65536):
                        body += c
                        if len(body) > 3_000_000: break
                resp.close()
                enc = resp.encoding if resp.encoding and resp.encoding.lower() != "iso-8859-1" else None
                t = body.decode(enc or "utf-8", errors="replace")
                rec.update(status=resp.status_code, final=resp.url, ctype=ct[:40])
                rec.update(scan(t))
        except Exception as e:
            rec["error"] = type(e).__name__
    with lock:
        out.write(json.dumps(rec, ensure_ascii=False) + "\n"); out.flush()

if __name__ == "__main__":
    IN, PREV, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
    done = set()
    if os.path.exists(OUT):
        for l in open(OUT, encoding="utf-8"):
            try: done.add(json.loads(l)["host"])
            except Exception: pass
    lock = threading.Lock(); out = open(OUT, "a", encoding="utf-8")
    
    items = [json.loads(l) for l in open(PREV, encoding="utf-8")]
    items = [r for r in items if r.get("status") == 200 and r["host"] not in done]
    print("todo", len(items), flush=True)
    with ThreadPoolExecutor(40) as ex:
        list(ex.map(work, items))
    print("fertig", flush=True)
