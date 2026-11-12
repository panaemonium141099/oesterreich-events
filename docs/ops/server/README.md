# Server-Skripte (Hetzner, /opt/app)

Kopien der Skripte, die auf dem Server laufen. Der Server ist die Quelle
für den Betrieb, diese Dateien sind der geprüfte Stand zum Einspielen.

## watchdog.sh (lt-watchdog.timer, alle 15 min)

Stand 2026-11-12, zwei Korrekturen gegenüber dem Server:

1. Health-Prüfung lokal gegen `127.0.0.1:3000`. Von außen bekommt der
   Server von der eigenen Bot-Sperre 403, das stand als Fehlalarm in jeder Mail.
2. Der Hash für „gleiche Lage“ ignoriert Zahlen. Vorher löste jeder
   Prozentpunkt der Platte eine neue Mail aus: 189 in drei Tagen.

Einspielen (Sicherung zuerst):

```bash
cp /opt/app/watchdog.sh /opt/app/watchdog.sh.bak-2026-11-12
```

```bash
scp docs/ops/server/watchdog.sh root@157.180.42.4:/opt/app/watchdog.sh
```
