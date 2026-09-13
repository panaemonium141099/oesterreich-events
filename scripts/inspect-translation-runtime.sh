#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import pathlib,re,subprocess
paths=['/opt/app/translate-backfill.sh','/opt/app/deploy.sh']
for path in paths:
    print('RUNTIME_FILE',path)
    for line in pathlib.Path(path).read_text().splitlines():
        if re.search(r'(?i)(api.?key|secret|password|token|authorization|xkeysib-|sk-proj-)',line):
            print('[credential-related line omitted]')
        else:
            print(line)
print('TIMER_CONFIG')
result=subprocess.run(['systemctl','cat','lt-translate-backfill.service','lt-translate-backfill.timer'],capture_output=True,text=True,check=True)
for line in result.stdout.splitlines():
    print('[credential-related line omitted]' if re.search(r'(?i)(api.?key|secret|password|token|authorization|^Environment=)',line) else line)
PY
