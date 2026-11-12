# fn-31-start-von-lasstreffende-eine-codebasis.14 Build in GitHub Actions: ein Image je Land, Server zieht nur

## Description
Images entstehen in GitHub Actions statt auf dem Datenbank-Server: je Land ein Image aus demselben Commit, der Server zieht nur noch.

**Size:** M
**Files:** `.github/workflows/deploy.yml`, `Dockerfile`, `docs/ops/server/compose.app.yml` (neu, Vorlage), `docs/ops/server/deploy.sh` (neu, Vorlage), `docs/ops/server/README.md`

## Approach
- Matrix `site: [at, de]` mit `docker/build-push-action`, `build-args: SITE_COUNTRY`, Push nach GHCR (`packages: write`), Cache je Land (`cache-from/to: type=gha,scope=<site>`, sonst überschreiben sich die Builds). `max-parallel: 1`, weil der Build gegen die Prod-Datenbank vorrendert.
- Build-Secrets weiter als BuildKit-Secret (`Dockerfile` um Zeile 58, `--mount=type=secret,id=buildenv`), nie als ARG.
- Der DE-Job baut erst, wenn Task 13 freigegebene Rechtstexte hat; bis dahin ist er per Schalter aus.
- Compose-Datei und `deploy.sh` liegen heute nur auf dem Server. Dieser Task legt Vorlagen ins Repo (`docker compose pull` und `up` statt `build`, zwei Dienste `nextjs-app` und `nextjs-app-de`, Log-Rotation wie bisher). Das Einspielen auf dem Server macht der Nutzer oder gibt er frei (Schreibzugriffe per SSH sind gesperrt).
- `deploy.yml` (`:40` bis `:53`): Revalidierung und Abruf für beide Domains.
- Rückweg: das vorige Image-Tag bleibt, `deploy.sh` nimmt ein Tag als Argument.

## Key context
- MASTERPLAN §3.15: der Build auf dem Server bremst die Datenbank bis zum Statement-Timeout. Der Umzug hilft auch AT allein und kann vor allem anderen live gehen.
- Der Build im Runner braucht Netz-Zugriff auf `api.lasstreffen.at`; Bot-Sperren und Rate-Limits für GitHub-Runner prüfen.
- Platte: alte Images auf dem Server aufräumen (`docker image prune` mit Filter), sonst wächst die Belegung.
## Acceptance
- [ ] Push auf master baut das AT-Image im Runner und veröffentlicht es; der Server baut nicht mehr
- [ ] Ein beobachteter Deploy während einer Nachbearbeitung ohne Lesefehler
- [ ] Vorlagen für Compose und `deploy.sh` im Repo, Abweichungen zum Server dokumentiert
- [ ] Rückweg auf das vorige Image getestet
- [ ] DE-Image baut per Schalter aus derselben Pipeline
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
