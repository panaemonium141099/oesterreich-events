while true; do
  c=$(curl -s "https://api.github.com/repos/panaemonium141099/oesterreich-events/actions/runs/29305622984" | grep -m1 '"conclusion"' | grep -oE '(success|failure|cancelled)' || true)
  if [ -n "$c" ]; then echo "ERSTER LPT-LAUF FERTIG: $c"; break; fi
  sleep 900
done
