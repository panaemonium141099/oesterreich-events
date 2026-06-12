'use client';
import { useEffect, useState } from 'react';

interface Prospect {
  id: string;
  domain: string;
  kind: string;
  org_name: string | null;
  website: string | null;
  bundesland: string | null;
  status: string;
  source_event_ids: string[];
  discovered_via: string | null;
}

export default function OutreachPage() {
  const [rows, setRows] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/outreach')
      .then((r) => r.json())
      .then((d) => setRows(d.prospects ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Outreach</h1>
      <p className="text-white/50 mb-6 text-sm">{rows.length} Prospects</p>
      {loading ? (
        <p className="text-white/40">Lädt…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-white/40 text-left">
            <tr>
              <th className="py-2 font-medium">Domain</th>
              <th className="font-medium">Name</th>
              <th className="font-medium">Typ</th>
              <th className="font-medium">Status</th>
              <th className="font-medium">Events</th>
              <th className="font-medium">Quelle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-white/10">
                <td className="py-2">
                  <a
                    href={`https://${p.domain}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-amber-400 hover:underline"
                  >
                    {p.domain}
                  </a>
                </td>
                <td>{p.org_name ?? '—'}</td>
                <td>{p.kind}</td>
                <td>{p.status}</td>
                <td>{p.source_event_ids?.length ?? 0}</td>
                <td className="text-white/40">{p.discovered_via}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
