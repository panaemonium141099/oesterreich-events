'use client';

import { usePushNotifications } from '@/lib/hooks/usePushNotifications';

/**
 * Card that lets PC users enable / disable Web-Push.
 * On mobile it renders a polite hint instead of a button, so they don't
 * get confused by a feature that doesn't apply to them.
 */
export function DesktopPushToggle() {
  const { status, errorMessage, enable, disable } = usePushNotifications();

  // Skip rendering nothing — mobile users get a tiny note so they know
  // it's a thing, not "why is the setting missing".
  if (status === 'unsupported') {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.015] p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1.5">
          Desktop-Benachrichtigungen
        </div>
        <p className="text-sm text-white/60">
          Nur am Desktop verfügbar. Auf dem Handy kommen Benachrichtigungen demnächst über die eigene App.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1.5">
            Desktop-Benachrichtigungen
          </div>
          <h3 className="text-[17px] font-light text-white/95 leading-snug">
            Auch wenn der Tab zu ist.
          </h3>
          <p className="text-sm text-white/55 leading-relaxed mt-2 max-w-md">
            Einladungen, Chats und RSVPs landen als Systembenachrichtigung auf deinem Desktop.
            Du kannst sie jederzeit wieder ausschalten.
          </p>
        </div>

        <div className={`w-2 h-2 rounded-full ${
          status === 'enabled' ? 'bg-emerald-400 shadow-[0_0_8px_theme(colors.emerald.400)]'
          : status === 'denied' ? 'bg-rose-400'
          : status === 'error'  ? 'bg-amber-400'
          : 'bg-white/30'
        }`} />
      </div>

      {status === 'denied' && (
        <p className="text-xs text-rose-300/80 leading-relaxed mb-3">
          Du hast Benachrichtigungen in diesem Browser geblockt. Um sie zu aktivieren, klick oben
          in der Adressleiste auf das Schloss-Symbol und erlaube „Benachrichtigungen".
        </p>
      )}
      {status === 'error' && errorMessage && (
        <p className="text-xs text-amber-300/80 mb-3">{errorMessage}</p>
      )}

      <div className="flex items-center gap-2">
        {status === 'enabled' ? (
          <button
            onClick={disable}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 text-sm text-white/70 hover:text-white hover:border-white/25 transition-all"
          >
            Deaktivieren
          </button>
        ) : (
          <button
            onClick={enable}
            disabled={status === 'loading' || status === 'denied'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                Moment …
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Auf diesem Rechner aktivieren
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
