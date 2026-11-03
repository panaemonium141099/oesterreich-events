"""Stufen-Matrix der neuen Erhebung und Diff zur vorherigen (Markdown).

  python diff.py <vorherige vollerhebung.csv> <neue vollerhebung.csv>
"""
import collections, csv, sys

sys.stdout.reconfigure(encoding="utf-8")
STUFEN = "ABCDEVMR"
NAMES = {"A": "A API oder Feed", "B": "B Hersteller-HTML", "C": "C eingebetteter Fremdkalender", "D": "D JSON-LD/Mikrodaten",
         "E": "E Kalender, allgemeiner Parser", "V": "V Kalender des Amts/der VG", "M": "M nur meinOrt (Lizenz)", "R": "R Rest"}
LAENDER = ["RP", "BY", "SH", "BW", "NI", "MV", "TH", "HE", "SN", "BB", "NW", "ST", "SL", "HB", "HH", "BE"]

old = {r["ags"]: r for r in csv.DictReader(open(sys.argv[1], encoding="utf-8"))}
new = {r["ags"]: r for r in csv.DictReader(open(sys.argv[2], encoding="utf-8"))}
n = len(new)
fmt = lambda x: f"{x:,}".replace(",", ".")
pct = lambda a, b: f"{a / b * 100:.1f} %".replace(".", ",") if b else "0 %"
integ = lambda r: r["integration"] if r["stufe"] in "ABCDE" else (f"VG: {r['vb_integration']}" if r["stufe"] == "V" else r["stufe"])

so = collections.Counter(r["stufe"] for r in old.values())
sn = collections.Counter(r["stufe"] for r in new.values())
print("### Stufen gesamt\n\n| Stufe | vorher | jetzt | Änderung |\n|---|---:|---:|---:|")
for s in STUFEN:
    print(f"| {NAMES[s]} | {fmt(so[s])} | {fmt(sn[s])} | {sn[s] - so[s]:+d} |")
reach_o, reach_n = sum(so[s] for s in "ABCDEVM"), sum(sn[s] for s in "ABCDEVM")
print(f"| erreicht A bis M | {fmt(reach_o)} ({pct(reach_o, len(old))}) | {fmt(reach_n)} ({pct(reach_n, n)}) | {reach_n - reach_o:+d} |")

print("\n### Matrix Land × Stufe (Gemeinden, jetzt)\n")
print("| Land | Gemeinden | " + " | ".join(STUFEN) + " | erreicht A bis M | vorher |")
print("|---|" + "---|" * (len(STUFEN) + 3))
for land in LAENDER:
    rn = [r for r in new.values() if r["land"] == land]
    ro = [r for r in old.values() if r["land"] == land]
    c = collections.Counter(r["stufe"] for r in rn)
    a = sum(c[s] for s in "ABCDEVM")
    ao = sum(1 for r in ro if r["stufe"] in "ABCDEVM")
    print(f"| {land} | {len(rn)} | " + " | ".join(str(c[s]) for s in STUFEN) + f" | {pct(a, len(rn))} | {pct(ao, len(ro))} |")

moves = collections.Counter((old[k]["stufe"], new[k]["stufe"]) for k in new if k in old and old[k]["stufe"] != new[k]["stufe"])
print(f"\n### Wechsel der Stufe ({fmt(sum(moves.values()))} Gemeinden)\n\n| von | nach | Gemeinden |\n|---|---|---:|")
for (a, b), c in moves.most_common(25):
    print(f"| {a} | {b} | {c} |")

im = collections.Counter((integ(old[k]), integ(new[k])) for k in new if k in old and integ(old[k]) != integ(new[k]))
print(f"\n### Wechsel der Integration ({fmt(sum(im.values()))} Gemeinden, häufigste)\n\n| vorher | jetzt | Gemeinden |\n|---|---|---:|")
for (a, b), c in im.most_common(30):
    print(f"| {a} | {b} | {c} |")

io = collections.Counter(integ(r) for r in old.values())
inn = collections.Counter(integ(r) for r in new.values())
print("\n### Integrationen (Gemeinden)\n\n| Integration | vorher | jetzt | Änderung |\n|---|---:|---:|---:|")
for k in sorted(set(io) | set(inn), key=lambda k: -inn[k]):
    if io[k] or inn[k]:
        print(f"| {k} | {io[k]} | {inn[k]} | {inn[k] - io[k]:+d} |")

host_changed = sum(1 for k in new if k in old and old[k]["host"] != new[k]["host"])
print(f"\nGemeinden mit anderem Host als vorher: {host_changed}. Neu: {len(set(new) - set(old))}, entfallen: {len(set(old) - set(new))}.")
