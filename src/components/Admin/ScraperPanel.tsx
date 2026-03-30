'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

interface ScraperInfo {
  name: string;
  displayName: string;
  category: string;
  eventCount: number;
  lastRun: string | null;
  status: 'idle' | 'running' | 'error';
  progress: {
    current: number;
    total: number;
    eventsFound: number;
    message: string;
  } | null;
}

interface CategoryGroup {
  name: string;
  icon: ReactNode;
  scrapers: ScraperInfo[];
}

const CATEGORY_ORDER = [
  'Burgenland',
  'Gemeinden',
  'Ticket-Plattformen',
  'Tourismus',
  'Wien',
  'Regional',
  'Spezial',
];

const CATEGORY_ICONS: Record<string, ReactNode> = {
  Burgenland: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21V3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18" />
    </svg>
  ),
  Gemeinden: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-10h2m4 0h2m-6 4h2m4 0h2" />
    </svg>
  ),
  'Ticket-Plattformen': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  ),
  Tourismus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Wien: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Regional: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  Spezial: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffH < 24) return `vor ${diffH} Std.`;
  if (diffD < 7) return `vor ${diffD} Tagen`;
  return new Date(dateStr).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
}

function StatusDot({ status }: { status: string }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
      </span>
    );
  }
  if (status === 'error') {
    return <span className="inline-flex rounded-full h-3 w-3 bg-red-500" />;
  }
  return <span className="inline-flex rounded-full h-3 w-3 bg-emerald-500/60" />;
}

interface GitHubRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  createdAt: string;
  updatedAt: string;
  trigger: string;
  url: string;
}

export default function ScraperPanel() {
  const [scrapers, setScrapers] = useState<ScraperInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAll, setRunningAll] = useState(false);
  const [runAllProgress, setRunAllProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [specialStatus, setSpecialStatus] = useState<Record<string, 'idle' | 'running' | 'done' | 'error'>>({});
  const [githubRuns, setGithubRuns] = useState<GitHubRun[]>([]);
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScrapers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scrapers');
      if (res.ok) {
        const data = await res.json();
        setScrapers(data);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Fetch scrapers error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGithubStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/scrapers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'github-status' }),
      });
      if (res.ok) {
        const data = await res.json();
        setGithubRuns(data.runs || []);
        setGithubConfigured(data.configured || false);
      }
    } catch { /* ignore */ }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchScrapers();
    fetchGithubStatus();
    // Poll GitHub status every 30s
    const ghInterval = setInterval(fetchGithubStatus, 30000);
    return () => clearInterval(ghInterval);
  }, [fetchScrapers, fetchGithubStatus]);

  // Auto-refresh while any scraper is running
  useEffect(() => {
    const hasRunning = scrapers.some(s => s.status === 'running') || runningAll ||
      Object.values(specialStatus).some(s => s === 'running');

    if (hasRunning) {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(fetchScrapers, 3000);
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [scrapers, runningAll, specialStatus, fetchScrapers]);

  const startScraper = async (name: string) => {
    setActionLoading(prev => ({ ...prev, [name]: true }));
    try {
      const res = await fetch('/api/admin/scrapers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', scraper: name }),
      });
      if (res.ok) {
        // Immediately update local state to show running
        setScrapers(prev => prev.map(s =>
          s.name === name ? { ...s, status: 'running' as const, progress: { current: 0, total: 0, eventsFound: 0, message: 'Starte...' } } : s
        ));
        // Start polling if not already
        if (!intervalRef.current) {
          intervalRef.current = setInterval(fetchScrapers, 3000);
        }
      }
    } catch (err) {
      console.error('Start scraper error:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [name]: false }));
    }
  };

  const stopScraper = async (name: string) => {
    setActionLoading(prev => ({ ...prev, [name]: true }));
    try {
      await fetch('/api/admin/scrapers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop', scraper: name }),
      });
      setScrapers(prev => prev.map(s =>
        s.name === name ? { ...s, status: 'idle' as const, progress: null } : s
      ));
    } catch (err) {
      console.error('Stop scraper error:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [name]: false }));
    }
  };

  const startAll = async () => {
    setRunningAll(true);
    const names = scrapers.map(s => s.name);
    setRunAllProgress({ current: 0, total: names.length, name: 'Alle starten...' });

    // Start ALL scrapers in parallel — each gets its own progress
    const startPromises = names.map(name => startScraper(name));
    await Promise.allSettled(startPromises);

    // Now poll until all are done via API (not stale state)
    setRunAllProgress({ current: 0, total: names.length, name: 'Alle laufen...' });
    let allDone = false;
    while (!allDone) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const res = await fetch('/api/admin/scrapers');
        if (res.ok) {
          const freshScrapers = await res.json();
          setScrapers(freshScrapers);
          const stillRunning = freshScrapers.filter((s: ScraperInfo) => s.status === 'running').length;
          const finished = names.length - stillRunning;
          setRunAllProgress({ current: finished, total: names.length, name: `${stillRunning} laufen noch...` });
          if (stillRunning === 0) allDone = true;
        }
      } catch { break; }
    }

    setRunningAll(false);
    setRunAllProgress(null);
    await fetchScrapers();
  };

  const triggerGithub = async (scraperName?: string) => {
    setGithubLoading(true);
    try {
      const res = await fetch('/api/admin/scrapers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-github', scraper: scraperName || '' }),
      });
      if (res.ok) {
        // Wait a moment then refresh status
        setTimeout(fetchGithubStatus, 3000);
      }
    } catch { /* ignore */ }
    finally { setGithubLoading(false); }
  };

  const runSpecialAction = async (action: string) => {
    setSpecialStatus(prev => ({ ...prev, [action]: 'running' }));
    try {
      const res = await fetch('/api/admin/scrapers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        // Poll for completion
        const progressName = action === 'validate' ? 'validate' : 'post-process';
        let attempts = 0;
        while (attempts < 200) {
          await new Promise(r => setTimeout(r, 3000));
          attempts++;
          try {
            const pRes = await fetch(`/api/admin/scrapers/${progressName}/progress`);
            if (pRes.ok) {
              const data = await pRes.json();
              if (data.status !== 'running') {
                setSpecialStatus(prev => ({ ...prev, [action]: data.status === 'error' ? 'error' : 'done' }));
                setTimeout(() => setSpecialStatus(prev => ({ ...prev, [action]: 'idle' })), 5000);
                return;
              }
            }
          } catch {
            break;
          }
        }
      }
      setSpecialStatus(prev => ({ ...prev, [action]: 'done' }));
      setTimeout(() => setSpecialStatus(prev => ({ ...prev, [action]: 'idle' })), 5000);
    } catch {
      setSpecialStatus(prev => ({ ...prev, [action]: 'error' }));
      setTimeout(() => setSpecialStatus(prev => ({ ...prev, [action]: 'idle' })), 5000);
    }
  };

  // Group scrapers by category
  const groupedScrapers: CategoryGroup[] = CATEGORY_ORDER.map(cat => ({
    name: cat,
    icon: CATEGORY_ICONS[cat] || CATEGORY_ICONS['Spezial'],
    scrapers: scrapers.filter(s => s.category === cat),
  })).filter(g => g.scrapers.length > 0);

  const totalEvents = scrapers.reduce((sum, s) => sum + s.eventCount, 0);
  const runningCount = scrapers.filter(s => s.status === 'running').length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header stats + action buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-2xl font-bold">{scrapers.length}</p>
            <p className="text-xs text-white/40">Scraper</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{totalEvents.toLocaleString('de-AT')}</p>
            <p className="text-xs text-white/40">Events gesamt</p>
          </div>
          {runningCount > 0 && (
            <div>
              <p className="text-2xl font-bold text-blue-400">{runningCount}</p>
              <p className="text-xs text-blue-400/60">laufend</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={startAll}
            disabled={runningAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              bg-emerald-500/15 text-emerald-400 border border-emerald-500/20
              hover:bg-emerald-500/25 hover:border-emerald-500/40
              disabled:opacity-40 disabled:cursor-not-allowed
              min-h-[44px]"
          >
            {runningAll ? (
              <>
                <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                {runAllProgress ? `${runAllProgress.current}/${runAllProgress.total}` : 'Starte...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Alle starten
              </>
            )}
          </button>

          <button
            onClick={() => runSpecialAction('validate')}
            disabled={specialStatus['validate'] === 'running'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              bg-amber-500/15 text-amber-400 border border-amber-500/20
              hover:bg-amber-500/25 hover:border-amber-500/40
              disabled:opacity-40 disabled:cursor-not-allowed
              min-h-[44px]"
          >
            {specialStatus['validate'] === 'running' ? (
              <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            ) : specialStatus['validate'] === 'done' ? (
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            Validieren
          </button>

          <button
            onClick={() => runSpecialAction('post-process')}
            disabled={specialStatus['post-process'] === 'running'}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              bg-purple-500/15 text-purple-400 border border-purple-500/20
              hover:bg-purple-500/25 hover:border-purple-500/40
              disabled:opacity-40 disabled:cursor-not-allowed
              min-h-[44px]"
          >
            {specialStatus['post-process'] === 'running' ? (
              <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            ) : specialStatus['post-process'] === 'done' ? (
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Post-Processing
          </button>
        </div>
      </div>

      {/* Run All progress */}
      {runningAll && runAllProgress && (
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Alle Scraper werden ausgefuehrt...</span>
            <span className="text-xs text-white/40">{runAllProgress.current}/{runAllProgress.total}</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${(runAllProgress.current / runAllProgress.total) * 100}%` }}
            />
          </div>
          {runAllProgress.name && (
            <p className="text-xs text-white/30 mt-1">Aktuell: {runAllProgress.name}</p>
          )}
        </div>
      )}

      {/* GitHub Actions Status */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-white/40" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium">GitHub Actions</h3>
            {githubRuns.some(r => r.status === 'in_progress') && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                Läuft
              </span>
            )}
          </div>
          <button
            onClick={() => triggerGithub()}
            disabled={githubLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all min-h-[36px] disabled:opacity-50"
          >
            {githubLoading ? (
              <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
            Workflow starten
          </button>
        </div>

        {!githubConfigured ? (
          <p className="text-xs text-white/30">GITHUB_TOKEN nicht konfiguriert. Setze es in .env.local um GitHub Actions zu steuern.</p>
        ) : githubRuns.length === 0 ? (
          <p className="text-xs text-white/30">Noch keine Workflow-Runs.</p>
        ) : (
          <div className="space-y-2">
            {githubRuns.map(run => (
              <div key={run.id} className="flex items-center gap-3 text-xs">
                {/* Status indicator */}
                {run.status === 'completed' && run.conclusion === 'success' && (
                  <span className="inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                )}
                {run.status === 'completed' && run.conclusion === 'failure' && (
                  <span className="inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                )}
                {run.status === 'in_progress' && (
                  <span className="relative inline-flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                  </span>
                )}
                {run.status === 'queued' && (
                  <span className="inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500" />
                )}
                {run.status === 'completed' && run.conclusion === 'cancelled' && (
                  <span className="inline-flex rounded-full h-2.5 w-2.5 bg-gray-500" />
                )}

                <span className="text-white/60">
                  {run.trigger === 'schedule' ? 'Automatisch (3:00)' : 'Manuell'}
                </span>
                <span className="text-white/30">
                  {new Date(run.createdAt).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`ml-auto ${
                  run.conclusion === 'success' ? 'text-emerald-400' :
                  run.conclusion === 'failure' ? 'text-red-400' :
                  run.status === 'in_progress' ? 'text-blue-400' :
                  'text-white/30'
                }`}>
                  {run.status === 'completed' ? (run.conclusion === 'success' ? 'Erfolgreich' : run.conclusion === 'failure' ? 'Fehlgeschlagen' : 'Abgebrochen') :
                   run.status === 'in_progress' ? 'Läuft...' : 'Warteschlange'}
                </span>
                <a href={run.url} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-white/50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scraper groups */}
      {groupedScrapers.map((group) => (
        <div key={group.name}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-white/30">{group.icon}</span>
            <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium">
              {group.name}
            </h3>
            <span className="text-xs text-white/20 ml-auto">
              {group.scrapers.reduce((s, sc) => s + sc.eventCount, 0).toLocaleString('de-AT')} Events
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {group.scrapers.map((scraper) => (
              <ScraperCard
                key={scraper.name}
                scraper={scraper}
                onStart={() => startScraper(scraper.name)}
                onStop={() => stopScraper(scraper.name)}
                isActionLoading={!!actionLoading[scraper.name]}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScraperCard({
  scraper,
  onStart,
  onStop,
  isActionLoading,
}: {
  scraper: ScraperInfo;
  onStart: () => void;
  onStop: () => void;
  isActionLoading: boolean;
}) {
  const progressPct = scraper.progress && scraper.progress.total > 0
    ? Math.round((scraper.progress.current / scraper.progress.total) * 100)
    : 0;

  return (
    <div className={`
      relative overflow-hidden rounded-xl border transition-all duration-200
      ${scraper.status === 'running'
        ? 'bg-blue-500/[0.04] border-blue-500/20'
        : scraper.status === 'error'
        ? 'bg-red-500/[0.04] border-red-500/20'
        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05] hover:border-white/15'}
      backdrop-blur-sm
    `}>
      {/* Progress bar background */}
      {scraper.status === 'running' && scraper.progress && scraper.progress.total > 0 && (
        <div
          className="absolute inset-0 bg-blue-500/[0.06] transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      )}

      <div className="relative flex items-center gap-3 p-3 sm:p-4">
        {/* Status dot */}
        <StatusDot status={scraper.status} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{scraper.displayName}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/25 font-mono shrink-0">
              {scraper.name}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {scraper.lastRun && (
              <span className="text-xs text-white/30">{timeAgo(scraper.lastRun)}</span>
            )}
            {scraper.status === 'running' && scraper.progress && (
              <span className="text-xs text-blue-400/70 truncate">
                {scraper.progress.message}
              </span>
            )}
            {scraper.status === 'error' && scraper.progress && (
              <span className="text-xs text-red-400/70 truncate">
                {scraper.progress.message}
              </span>
            )}
          </div>
        </div>

        {/* Event count */}
        <div className="text-right shrink-0 mr-2">
          <p className="text-sm font-bold tabular-nums">
            {scraper.status === 'running' && scraper.progress
              ? scraper.progress.eventsFound.toLocaleString('de-AT')
              : scraper.eventCount.toLocaleString('de-AT')
            }
          </p>
          <p className="text-[10px] text-white/25">Events</p>
        </div>

        {/* Progress percentage when running */}
        {scraper.status === 'running' && progressPct > 0 && (
          <div className="text-right shrink-0 mr-1">
            <p className="text-xs font-bold text-blue-400 tabular-nums">{progressPct}%</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {scraper.status === 'running' ? (
            <button
              onClick={onStop}
              disabled={isActionLoading}
              className="inline-flex items-center justify-center w-[44px] h-[44px] rounded-xl
                bg-red-500/10 text-red-400 border border-red-500/20
                hover:bg-red-500/20 hover:border-red-500/30
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200"
              title="Stoppen"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={isActionLoading}
              className="inline-flex items-center justify-center w-[44px] h-[44px] rounded-xl
                bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
                hover:bg-emerald-500/20 hover:border-emerald-500/30
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200"
              title="Starten"
            >
              {isActionLoading ? (
                <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar at bottom when running */}
      {scraper.status === 'running' && (
        <div className="h-1 bg-white/5">
          <div
            className={`h-full rounded-r-full transition-all duration-500 ${
              scraper.progress && scraper.progress.total > 0
                ? 'bg-gradient-to-r from-blue-500 to-blue-400'
                : 'bg-blue-500/50 animate-pulse'
            }`}
            style={{
              width: scraper.progress && scraper.progress.total > 0
                ? `${progressPct}%`
                : '100%',
            }}
          />
        </div>
      )}
    </div>
  );
}
