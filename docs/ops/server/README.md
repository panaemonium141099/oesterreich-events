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

## deploy-image.sh (Build im GitHub-Runner, fn-31.14)

Bisher baut `/opt/app/deploy.sh` das App-Image auf dem Server, neben der
Datenbank. Während der Typprüfung liefen Abfragen der Nachtläufe in den
Statement-Timeout (MASTERPLAN §3.15). Mit `deploy-image.sh` baut der
GitHub-Runner (`scripts/deploy/build-image.sh`), der Server lädt das Image
nur noch und startet es.

`deploy-image.sh` ist mit `/opt/app/deploy.sh` abgeglichen (gelesen am
14.11.2026) und liegt seit diesem Tag auf dem Server: dieselbe Sperre
(`/var/lock/lt-deploy.lock`), dasselbe Aufräumen der Platte und der
Recreate-Reste, derselbe Dienst (`nextjs`, Image `lasstreffen-app:latest`,
Container `nextjs-app`), derselbe Health-Check mit Rückfall auf
`lasstreffen-app:previous`. Es entfällt nur `docker compose build`; der
Quellstand in `/opt/app/src` wird weiter nachgezogen.

Geladen wird ein Image von rund 1,85 GB (entpackt), das vorige bleibt als
`:previous`. Unter 4 GB freier Platte bricht das Skript ab.

### Probe ohne Deploy

Workflow `deploy` von Hand starten mit `build_only: true`. Der Runner holt
`/opt/app/.env.master`, baut das Image und verwirft beides wieder; auf dem
Server ändert sich nichts. Mit `site: DE` baut dieselbe Probe lasstreffen.de.

### Einspielen und umstellen

```bash
scp docs/ops/server/deploy-image.sh root@157.180.42.4:/opt/app/deploy-image.sh
```

```bash
ssh root@157.180.42.4 'chmod 755 /opt/app/deploy-image.sh'
```

```bash
gh variable set DEPLOY_BUILD --body runner
```

Der nächste Push auf master nimmt dann den neuen Weg. `deploy.sh` bleibt
unverändert liegen.

### Rückweg

Voriges Image wieder starten:

```bash
ssh root@157.180.42.4 '/opt/app/deploy-image.sh --rollback'
```

Zurück zum Build auf dem Server:

```bash
gh variable delete DEPLOY_BUILD
```

### Nicht enthalten

Ein zweiter Container für lasstreffen.de (eigener Dienst, eigener Image-Name,
Caddy-Block) gehört zu fn-31.15 und braucht die Kapazitätsaussage aus fn-31.1.
