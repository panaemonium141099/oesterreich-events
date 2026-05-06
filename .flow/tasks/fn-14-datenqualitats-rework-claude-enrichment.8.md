# fn-14-datenqualitats-rework-claude-enrichment.8 Daily-Refresh: GitHub Actions schedule

## Description

Optionaler Daily-Refresh: GitHub Actions schedule triggert täglich nachts einen Enrichment-Run für die kleinen Δ-Mengen (typisch 50-200 frisch gescrapte Events). System bekommt täglich neue Events automatisch enriched.

**WICHTIG (aus Codex-Review):** Eine konkrete Runtime gewählt, nicht "drei Optionen, du wählst". **GitHub Actions** ist die gewählte Variante (Vercel Functions können kein claude binary spawnen, Anthropic Routines sind setup-aufwendig).

Variante "Vercel Cron" und "Anthropic Routine" werden als future-options in `## Out of Scope` dokumentiert.

**Size:** S-M (1 workflow file, secrets setup, 6 acceptance criteria)

**Files:**
- `.github/workflows/daily-enrich.yml` (NEU)

## Approach

### Auth-Strategie
Zwei Optionen für Claude-Auth in GitHub Actions:
1. **`ANTHROPIC_API_KEY`** — KOSTET Tokens (nicht MAX-Plan). Trade-off: User akzeptiert kleine API-Kosten für Daily-Refresh.
2. **MAX-Plan OAuth Token** — falls Anthropic ein Token-Export aus claude-code CLI ermöglicht. Kostenlos, aber Setup-Aufwand. **Recherche-Subtask** in dieser Task.

Falls Option 2 nicht möglich: Option 1 als fallback. User-Decision dokumentiert in Task-Done-Summary.

### Workflow YAML
```yaml
name: Daily Claude Enrichment
on:
  schedule:
    - cron: '0 3 * * *'   # 03:00 UTC = 04:00/05:00 Europe/Vienna
  workflow_dispatch:        # manuelles trigger
jobs:
  enrich:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install Claude Code CLI
        run: npm install -g @anthropic-ai/claude-code
      - name: Verify claude
        run: claude --version
      - name: Install deps
        run: npm install
      - name: Run enrichment
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: npm run enrich:claude -- --since=24h --limit=500 --log-file enrichment-${{ github.run_id }}.jsonl
      - name: Upload log
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: enrichment-log
          path: enrichment-*.jsonl
```

### Required GitHub Secrets
- `ANTHROPIC_API_KEY` (oder OAuth-Token wenn verifiziert)
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (Codex-Finding korrigiert: ROLE_KEY ist Standard im Repo, ~96 Files nutzen es)

User muss diese in GitHub repo settings -> Secrets manuell setzen. Task-Done-Summary dokumentiert dies als manuellen Schritt.

### Failure-Handling
- Workflow timeout 60 min (max enrichment für 500 events)
- `if: always()` für log upload (auch bei Fehler)
- Bei `--since=24h` filter: typisch 50-200 events, weit unter 60min
- Bei API-quota-error: `npm run enrich:claude` exits mit non-zero -> workflow fails -> GitHub email notification

### --since Flag in enrich-claude.ts
fn-14.3 muss `--since=24h` flag implementieren:
- berechnet ISO-timestamp `now() - 24h`
- selection-filter: `WHERE updated_at > <timestamp>` ZUSÄTZLICH zum standard filter
- `--limit 500` als hard cap (`--max-events` ist Alias, beide funktionieren)

(Diese flags werden in fn-14.3 spec acceptance hinzugefügt — siehe dort.)

## Key context

- GitHub Actions free tier: 2.000 min/Monat für public repos, 50.000 min für private (mit Pro-Account)
- Claude Code CLI installation: `npm install -g @anthropic-ai/claude-code` (~2min)
- `secrets.ANTHROPIC_API_KEY` muss vom User manuell in repo-settings gesetzt werden
- Workflow läuft auch wenn repo-activity 0 ist (im Gegensatz zu PR-triggered workflows)
- `Vercel Cron` als alternative: Vercel Functions können `claude` binary nicht installieren -> deshalb verworfen
- `Anthropic Routine` als alternative: höherer Setup-Aufwand, MCP-dependency, weniger logging-control -> deshalb verworfen

## Acceptance

- [ ] `.github/workflows/daily-enrich.yml` existiert mit cron `0 3 * * *` UTC
- [ ] `workflow_dispatch` enabled für manuelles trigger
- [ ] Workflow installiert claude CLI + node deps + ruft `npm run enrich:claude --since=24h`
- [ ] User hat GitHub Secrets gesetzt (ANTHROPIC_API_KEY, SUPABASE-URLs/Keys) — dokumentiert in Done-Summary
- [ ] Erster Test-Run via workflow_dispatch erfolgreich (manuell trigger)
- [ ] Logs zeigen `events_processed >= 0` mit klarer Status-Message ("processed N events" ODER "no eligible events for last 24h"). Erster Test darf 0 events haben — Acceptance ist "workflow läuft fehlerfrei und loggt eindeutig"
- [ ] Failure-Mode dokumentiert (quota / network / timeout)
- [ ] (NICHT in scope: Vercel Cron, Anthropic Routine — als future-option in spec dokumentiert)

## Done summary
TBD

## Evidence
- Commits:
- Workflow YAML:
- First-run logs:
- Auth-Variante gewählt (API-Key vs. OAuth):
