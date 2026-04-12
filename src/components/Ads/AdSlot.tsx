'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

interface AdSlotProps {
  slot: string;
  format?: 'auto' | 'horizontal' | 'rectangle';
  className?: string;
}

export function AdSlot({ slot, format = 'auto', className }: AdSlotProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const [consented, setConsented] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    setConsented(consent === 'all');
  }, []);

  useEffect(() => {
    if (!consented || !clientId || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded yet — ignore
    }
  }, [consented, clientId]);

  if (!clientId || !consented) return null;

  return (
    <div className={`my-6 ${className ?? ''}`}>
      <p className="text-[11px] text-white/30 mb-1">Anzeige</p>
      <ins
        ref={adRef}
        className="adsbygoogle block"
        style={{ display: 'block', minHeight: 90 }}
        data-ad-client={clientId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
