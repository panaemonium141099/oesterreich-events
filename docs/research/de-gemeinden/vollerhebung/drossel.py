"""Abrufe je Server nacheinander: hoechstens ein Abruf-Start alle GAP Sekunden je IP.

Viele Gemeinde-Websites liegen auf einem gemeinsamen Server (verwaltungsportal.de:
alle rund 750 Websites auf 144.76.55.199). Der sperrte am 2026-10-29 bei rund acht
Abrufen je Sekunde ueber mehrere Websites hinweg (fn-29.11); GeoCMS sperrte im
November. Parallel laufen deshalb nur verschiedene Server, nie dieselbe IP.
Wird beim Import von detect.py aktiv (detect2.py und detect3.py importieren es).
"""
import os, socket, threading, time
import requests

GAP = 3.0
# Gleichzeitige Abrufe insgesamt (verschiedene Server); je Server bleibt es bei einem.
THREADS = int(os.environ.get("VH_THREADS", "100"))
_ip_cache: dict = {}
_locks: dict = {}
_last: dict = {}
_guard = threading.Lock()


def _server(url):
    host = requests.utils.urlparse(url).hostname or ""
    with _guard:
        if host in _ip_cache:
            return _ip_cache[host]
    try:
        ip = socket.gethostbyname(host)
    except Exception:
        ip = host
    with _guard:
        _ip_cache[host] = ip
    return ip


_orig = requests.sessions.Session.request


def _request(self, method, url, *args, **kwargs):
    ip = _server(url)
    with _guard:
        lock = _locks.setdefault(ip, threading.Lock())
    with lock:
        wait = _last.get(ip, 0) + GAP - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last[ip] = time.monotonic()
    return _orig(self, method, url, *args, **kwargs)


requests.sessions.Session.request = _request
