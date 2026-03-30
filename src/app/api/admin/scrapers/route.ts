import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Scraper registry with display names and categories
const SCRAPER_REGISTRY: Record<string, { displayName: string; category: string }> = {
  // Gemeinden
  'gem2go': { displayName: 'GEM2GO Gemeinden', category: 'Gemeinden' },
  'gemeinden': { displayName: 'Gemeinde-Websites', category: 'Gemeinden' },
  'gemeinden-generic': { displayName: 'Gemeinden Generic', category: 'Gemeinden' },
  // Ticket-Plattformen
  'oeticket': { displayName: 'oeticket', category: 'Ticket-Plattformen' },
  'ticketmaster': { displayName: 'Ticketmaster', category: 'Ticket-Plattformen' },
  'events.at': { displayName: 'Events.at', category: 'Ticket-Plattformen' },
  'feverup': { displayName: 'Fever Up', category: 'Ticket-Plattformen' },
  // Tourismus
  'feratel-deskline': { displayName: 'Feratel Deskline', category: 'Tourismus' },
  'burgenland.info': { displayName: 'Burgenland Info', category: 'Tourismus' },
  'neusiedlersee.com': { displayName: 'Neusiedlersee', category: 'Tourismus' },
  'tourismus-portale': { displayName: 'Tourismus Portale', category: 'Tourismus' },
  'gastein': { displayName: 'Gastein', category: 'Tourismus' },
  'graztourismus': { displayName: 'Graz Tourismus', category: 'Tourismus' },
  'vorarlberg.travel': { displayName: 'Vorarlberg Travel', category: 'Tourismus' },
  // Burgenland
  'burgenland.at': { displayName: 'Landesregierung Bgld', category: 'Burgenland' },
  'esterhazy.at': { displayName: 'Esterhazy', category: 'Burgenland' },
  'oho.at': { displayName: 'OHO Oberwart', category: 'Burgenland' },
  // Wien
  'wien-clubs': { displayName: 'Wien Clubs', category: 'Wien' },
  'ganz-wien': { displayName: 'Ganz Wien', category: 'Wien' },
  'falter': { displayName: 'Falter', category: 'Wien' },
  'stadthalle': { displayName: 'Stadthalle', category: 'Wien' },
  'partytimer': { displayName: 'Partytimer', category: 'Wien' },
  'basiskultur': { displayName: 'Basiskultur', category: 'Wien' },
  'wien-gv': { displayName: 'Wien.gv.at', category: 'Wien' },
  'wien-vadb': { displayName: 'Wien VADB', category: 'Wien' },
  'wien.info': { displayName: 'Wien Info', category: 'Wien' },
  'praterwien': { displayName: 'Prater Wien', category: 'Wien' },
  // Regional
  'meinbezirk': { displayName: 'MeinBezirk', category: 'Regional' },
  'veranstaltungskalender.net': { displayName: 'Veranstaltungskalender.net', category: 'Regional' },
  'kultur-graz': { displayName: 'Kultur Graz', category: 'Regional' },
  'kaernten.live': { displayName: 'Kaernten Live', category: 'Regional' },
  'linztermine': { displayName: 'Linz Termine', category: 'Regional' },
  'donau-noe': { displayName: 'Donau NOE', category: 'Regional' },
  'bodensee-vorarlberg': { displayName: 'Bodensee Vorarlberg', category: 'Regional' },
  'tirol.at': { displayName: 'Tirol.at', category: 'Regional' },
  'events.tt': { displayName: 'Events.tt', category: 'Regional' },
  // Spezial
  'mariazell.at': { displayName: 'Mariazell.at', category: 'Spezial' },
  'basilika-mariazell': { displayName: 'Basilika Mariazell', category: 'Spezial' },
  'mariazell.gv.at': { displayName: 'Mariazell Gemeinde', category: 'Spezial' },
  'rockhouse': { displayName: 'Rockhouse Salzburg', category: 'Spezial' },
  'argekultur': { displayName: 'ARGEkultur', category: 'Spezial' },
  'szene-salzburg': { displayName: 'Szene Salzburg', category: 'Spezial' },
  'posthof': { displayName: 'Posthof Linz', category: 'Spezial' },
  'popculture': { displayName: 'Popculture', category: 'Spezial' },
};

const DATA_DIR = path.join(process.cwd(), 'data');

function getProgressFilePath(name: string): string {
  return path.join(DATA_DIR, `scraper-progress-${name}.json`);
}

function readProgress(name: string): { status: string; current: number; total: number; eventsFound: number; message: string; startedAt: string } | null {
  const filePath = getProgressFilePath(name);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {
    // ignore read errors
  }
  return null;
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Get event counts by source
    const { data: srcData } = await supabase
      .from('events')
      .select('source_name')
      .not('source_name', 'is', null)
      .eq('source_type', 'scraped');

    const srcCounts: Record<string, number> = {};
    (srcData || []).forEach((e: { source_name: string | null }) => {
      if (e.source_name) {
        srcCounts[e.source_name] = (srcCounts[e.source_name] || 0) + 1;
      }
    });

    // Get last created_at per source
    const { data: lastRunData } = await supabase
      .from('events')
      .select('source_name, created_at')
      .not('source_name', 'is', null)
      .eq('source_type', 'scraped')
      .order('created_at', { ascending: false });

    const lastRuns: Record<string, string> = {};
    (lastRunData || []).forEach((e: { source_name: string | null; created_at: string }) => {
      if (e.source_name && !lastRuns[e.source_name]) {
        lastRuns[e.source_name] = e.created_at;
      }
    });

    // Build scraper list
    const scrapers = Object.entries(SCRAPER_REGISTRY).map(([name, info]) => {
      const progress = readProgress(name);
      const status = progress?.status === 'running' ? 'running' :
                     progress?.status === 'error' ? 'error' : 'idle';

      return {
        name,
        displayName: info.displayName,
        category: info.category,
        eventCount: srcCounts[name] || 0,
        lastRun: lastRuns[name] || null,
        status,
        progress: progress?.status === 'running' ? {
          current: progress.current,
          total: progress.total,
          eventsFound: progress.eventsFound,
          message: progress.message,
        } : null,
      };
    });

    return NextResponse.json(scrapers);
  } catch (err) {
    console.error('Scraper list error:', err);
    return NextResponse.json({ error: 'Fehler beim Laden der Scraper' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, scraper: scraperName } = body;

    if (action === 'start' && scraperName) {
      const progressFile = getProgressFilePath(scraperName);

      // Check if already running
      const existing = readProgress(scraperName);
      if (existing?.status === 'running') {
        return NextResponse.json({ error: 'Scraper laeuft bereits' }, { status: 409 });
      }

      // Write initial progress
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(progressFile, JSON.stringify({
        status: 'running',
        current: 0,
        total: 0,
        eventsFound: 0,
        message: 'Starte...',
        startedAt: new Date().toISOString(),
      }));

      // Spawn scraper as child process
      const child = spawn('npx', ['tsx', 'src/scripts/scrape.ts', '--source', scraperName], {
        cwd: process.cwd(),
        stdio: 'pipe',
        shell: true,
        detached: false,
      });

      // Monitor stdout for progress updates
      child.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log(`[scraper:${scraperName}] ${output}`);

        // Try to parse progress markers from output
        try {
          const current = readProgress(scraperName);
          if (current && current.status === 'running') {
            // Extract event counts from log output
            const fertigMatch = output.match(/Fertig:\s*(\d+)\s*gefunden/);
            if (fertigMatch) {
              current.eventsFound = parseInt(fertigMatch[1]);
              current.status = 'finishing';
              current.message = `${current.eventsFound} Events gefunden`;
            }
            fs.writeFileSync(progressFile, JSON.stringify(current));
          }
        } catch {
          // ignore progress write errors
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        console.error(`[scraper:${scraperName}:err] ${data.toString()}`);
      });

      child.on('close', (code) => {
        try {
          if (code === 0) {
            // Success - delete progress file
            if (fs.existsSync(progressFile)) {
              fs.unlinkSync(progressFile);
            }
          } else {
            // Error - write error status
            fs.writeFileSync(progressFile, JSON.stringify({
              status: 'error',
              current: 0,
              total: 0,
              eventsFound: 0,
              message: `Prozess beendet mit Code ${code}`,
              startedAt: new Date().toISOString(),
            }));
          }
        } catch {
          // ignore
        }
      });

      return NextResponse.json({ success: true, message: `Scraper ${scraperName} gestartet` });
    }

    if (action === 'stop' && scraperName) {
      const progressFile = getProgressFilePath(scraperName);
      // Write stopped status
      if (fs.existsSync(progressFile)) {
        fs.writeFileSync(progressFile, JSON.stringify({
          status: 'stopped',
          current: 0,
          total: 0,
          eventsFound: 0,
          message: 'Manuell gestoppt',
          startedAt: new Date().toISOString(),
        }));
        // Clean up after a moment
        setTimeout(() => {
          try { if (fs.existsSync(progressFile)) fs.unlinkSync(progressFile); } catch { /* */ }
        }, 2000);
      }
      return NextResponse.json({ success: true, message: `Scraper ${scraperName} gestoppt` });
    }

    if (action === 'start-all') {
      // Return list of scrapers to start sequentially from client
      const names = Object.keys(SCRAPER_REGISTRY);
      return NextResponse.json({ success: true, scrapers: names });
    }

    if (action === 'validate') {
      const child = spawn('node', ['src/scripts/validate-events.js'], {
        cwd: process.cwd(),
        stdio: 'pipe',
        shell: true,
      });

      const progressFile = path.join(DATA_DIR, 'scraper-progress-validate.json');
      fs.writeFileSync(progressFile, JSON.stringify({
        status: 'running',
        current: 0,
        total: 0,
        eventsFound: 0,
        message: 'Validiere Events...',
        startedAt: new Date().toISOString(),
      }));

      child.on('close', (code) => {
        try {
          if (code === 0) {
            if (fs.existsSync(progressFile)) fs.unlinkSync(progressFile);
          } else {
            fs.writeFileSync(progressFile, JSON.stringify({
              status: 'error', current: 0, total: 0, eventsFound: 0,
              message: `Validierung fehlgeschlagen (Code ${code})`,
              startedAt: new Date().toISOString(),
            }));
          }
        } catch { /* */ }
      });

      return NextResponse.json({ success: true, message: 'Validierung gestartet' });
    }

    if (action === 'post-process') {
      const child = spawn('npx', ['tsx', 'src/scripts/post-process.ts'], {
        cwd: process.cwd(),
        stdio: 'pipe',
        shell: true,
      });

      const progressFile = path.join(DATA_DIR, 'scraper-progress-post-process.json');
      fs.writeFileSync(progressFile, JSON.stringify({
        status: 'running',
        current: 0,
        total: 0,
        eventsFound: 0,
        message: 'Post-Processing (Geocoding + Bundesland)...',
        startedAt: new Date().toISOString(),
      }));

      child.on('close', (code) => {
        try {
          if (code === 0) {
            if (fs.existsSync(progressFile)) fs.unlinkSync(progressFile);
          } else {
            fs.writeFileSync(progressFile, JSON.stringify({
              status: 'error', current: 0, total: 0, eventsFound: 0,
              message: `Post-Processing fehlgeschlagen (Code ${code})`,
              startedAt: new Date().toISOString(),
            }));
          }
        } catch { /* */ }
      });

      return NextResponse.json({ success: true, message: 'Post-Processing gestartet' });
    }

    if (action === 'start-github') {
      // Trigger GitHub Actions workflow
      const ghToken = process.env.GITHUB_TOKEN;
      const repo = process.env.GITHUB_REPO || 'panaemonium141099/oesterreich-events';

      if (!ghToken) {
        return NextResponse.json({ error: 'GITHUB_TOKEN nicht konfiguriert' }, { status: 500 });
      }

      const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/scrape-events.yml/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          ref: 'master',
          inputs: scraperName ? { scraper: scraperName } : {},
        }),
      });

      if (res.status === 204) {
        return NextResponse.json({ success: true, message: 'GitHub Workflow gestartet' });
      } else {
        const errText = await res.text();
        return NextResponse.json({ error: `GitHub API Fehler: ${res.status} ${errText}` }, { status: 500 });
      }
    }

    if (action === 'github-status') {
      // Get latest workflow runs
      const ghToken = process.env.GITHUB_TOKEN;
      const repo = process.env.GITHUB_REPO || 'panaemonium141099/oesterreich-events';

      if (!ghToken) {
        return NextResponse.json({ runs: [], configured: false });
      }

      try {
        const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/scrape-events.yml/runs?per_page=5`, {
          headers: {
            'Authorization': `Bearer ${ghToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const runs = data.workflow_runs?.map((run: { id: number; status: string; conclusion: string | null; created_at: string; updated_at: string; event: string; html_url: string }) => ({
            id: run.id,
            status: run.status, // queued, in_progress, completed
            conclusion: run.conclusion, // success, failure, null
            createdAt: run.created_at,
            updatedAt: run.updated_at,
            trigger: run.event, // schedule, workflow_dispatch
            url: run.html_url,
          })) || [];
          return NextResponse.json({ runs, configured: true });
        }
        return NextResponse.json({ runs: [], configured: true, error: 'API Fehler' });
      } catch {
        return NextResponse.json({ runs: [], configured: true, error: 'Verbindungsfehler' });
      }
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (err) {
    console.error('Scraper action error:', err);
    return NextResponse.json({ error: 'Fehler bei Scraper-Aktion' }, { status: 500 });
  }
}
