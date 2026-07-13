while true; do
  s=$(curl -s "https://api.github.com/repos/panaemonium141099/oesterreich-events/actions/runs/29224832841" | grep -m1 '"conclusion"' | grep -oE '(success|failure|cancelled)' || true)
  if [ -n "$s" ]; then echo "HEUTIGER PIPELINE-RUN FERTIG: $s"; break; fi
  sleep 300
done
