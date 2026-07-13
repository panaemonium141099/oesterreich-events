# Warte auf Deploy von 390639f, dann pruefe 5 der eingefrorenen URLs frisch
sleep 240
urls="/events/1030-wien/2026-07-15/michael-niavarani-homo-idioticus-2-0-der-trottel-ist /events/1010-wien/2026-07-16/wiener-mozart-konzert-musikverein-musikverein-wien /events/1010-wien/2026-07-14/klassik-in-der-annakirche /events/1040-wien/2026-07-17/vivaldi-die-vier-jahreszeiten-konzert-in-der-karlskirche /events/3300-st-poelten/2026-07-17/the-band-johann-poelz-halle"
for round in 1 2 3 4 5 6; do
  ok=0; frozen=0
  for p in $urls; do
    html=$(curl -sL "https://lasstreffen.at$p?heal=$round" 2>/dev/null)
    if echo "$html" | grep -q "Wird geladen"; then frozen=$((frozen+1)); else ok=$((ok+1)); fi
  done
  echo "Runde $round: ok=$ok frozen=$frozen"
  [ "$frozen" -eq 0 ] && { echo "ALLE 5 SEITEN RENDERN WIEDER VOLL"; exit 0; }
  sleep 600
done
echo "NACH 6 RUNDEN NOCH $frozen/5 EINGEFROREN - Node-Version im Vercel-Dashboard pruefen!"
