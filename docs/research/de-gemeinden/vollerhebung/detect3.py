"""Dritter Durchgang fuer die Restgruppen: breitere Datumserkennung (leer),
Standardpfade (kein_link), URL-Varianten (fehler). Hoechstens 5 Anfragen je Host."""
import sys, json, re, os, csv, threading, urllib.parse, urllib.robotparser
from concurrent.futures import ThreadPoolExecutor
import requests, urllib3
urllib3.disable_warnings()
sys.path.insert(0, os.path.dirname(__file__))
from detect import UA
import detect2

D, OUT = sys.argv[1], sys.argv[2]
MON = "Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jan|Feb|Mär|Apr|Jun|Jul|Aug|Sep|Okt|Nov|Dez"
DATES = re.compile(r"\b\d{1,2}\.\s?\d{1,2}\.\s?(?:20)?2[6-8]\b|\b\d{1,2}\.\s?(?:%s)\.?\s+20(?:26|27|28)\b|\b202[6-8]-[01]\d-[0-3]\d\b|\b(?:Mo|Di|Mi|Do|Fr|Sa|So)\.?,?\s+\d{1,2}\.\s?\d{1,2}\.?" % MON, re.I)
JSCAL = re.compile(r"fullcalendar|vue-cal|calendar-widget|eventlist|event-list|veranstaltungsliste|data-events|ajax.*(?:termine|veranstaltung)", re.I)
PATHS = ["/veranstaltungen/", "/termine/", "/veranstaltungskalender/", "/events/"]

rows = list(csv.DictReader(open(f"{D}/gemeinden_klassifiziert.csv", encoding="utf-8")))
p1 = {json.loads(l)["host"]: json.loads(l) for l in open(f"{D}/detect.jsonl", encoding="utf-8")}
todo = {}
for r in rows:
    if r["integration"] in ("leer", "kein_link", "fehler") and r["host"]:
        todo.setdefault(r["host"], (r["integration"], r["event_url"]))
done = set()
if os.path.exists(OUT):
    for l in open(OUT, encoding="utf-8"):
        done.add(json.loads(l)["host"])
lock = threading.Lock(); out = open(OUT, "a", encoding="utf-8")
S = requests.Session()

def get(u, verify=True):
    resp = S.get(u, headers={"User-Agent": UA, "Accept": "text/html", "Accept-Language": "de"}, timeout=20, stream=True, verify=verify)
    ct = resp.headers.get("content-type", ""); body = b""
    if "html" in ct or not ct:
        for c in resp.iter_content(65536):
            body += c
            if len(body) > 3_000_000: break
    resp.close()
    enc = resp.encoding if resp.encoding and resp.encoding.lower() != "iso-8859-1" else None
    return resp, body.decode(enc or "utf-8", errors="replace")

def allowed(u, verify=True):
    p = urllib.parse.urlsplit(u); rp = urllib.robotparser.RobotFileParser()
    try:
        rr = S.get(f"{p.scheme}://{p.netloc}/robots.txt", headers={"User-Agent": UA}, timeout=15, verify=verify)
        rp.parse([] if rr.status_code >= 400 else rr.text.splitlines())
    except Exception:
        rp.parse([])
    return rp.can_fetch(UA, u)

def summarize(rec, t):
    rec.update(detect2.scan(t))
    rec["dates2"] = len(DATES.findall(t)); rec["jscal"] = bool(JSCAL.search(t))

def work(item):
    host, (kind, evu) = item
    rec = {"host": host, "kind": kind}
    try:
        if kind == "leer" and evu:
            if allowed(evu):
                resp, t = get(evu); rec.update(status=resp.status_code, final=resp.url, url=evu); summarize(rec, t)
            else:
                rec["robots_blocked"] = True
        elif kind == "kein_link":
            base = p1[host].get("final") or ("https://" + host)
            p = urllib.parse.urlsplit(base); root = f"{p.scheme}://{p.netloc}"
            if not allowed(root + "/"):
                rec["robots_blocked"] = True
            else:
                for path in PATHS:
                    resp, t = get(root + path)
                    if resp.status_code == 200 and urllib.parse.urlsplit(resp.url).path.rstrip("/") not in ("", "/index.php", "/index.html"):
                        rec.update(status=200, final=resp.url, url=root + path); summarize(rec, t); break
                else:
                    rec["status"] = "keiner"
        elif kind == "fehler":
            for v in (f"https://www.{host}/", f"https://{host}/", f"http://www.{host}/", f"http://{host}/"):
                try:
                    resp, t = get(v, verify=False)
                except Exception:
                    continue
                if resp.status_code == 200 and len(t) > 500:
                    rec.update(status=200, final=resp.url, url=v); summarize(rec, t)
                    rec["home_markers"] = rec.get("markers"); break
            else:
                rec["status"] = "weiter_fehler"
    except Exception as e:
        rec["error"] = type(e).__name__
    with lock:
        out.write(json.dumps(rec, ensure_ascii=False) + "\n"); out.flush()

items = [(h, v) for h, v in todo.items() if h not in done]
print("todo", len(items), collections_counter := {k: sum(1 for _, (kk, _) in items if kk == k) for k in ("leer", "kein_link", "fehler")}, flush=True)
with ThreadPoolExecutor(40) as ex:
    list(ex.map(work, items))
print("fertig", flush=True)
