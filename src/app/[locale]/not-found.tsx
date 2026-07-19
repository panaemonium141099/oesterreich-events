import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-7xl font-bold text-slate-700 mb-2">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Seite nicht gefunden</h1>
        <p className="text-slate-400 mb-8">
          Die gesuchte Seite existiert nicht oder wurde verschoben.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/map"
            className="px-6 py-3 bg-white text-slate-900 font-medium rounded-xl hover:bg-slate-100 transition-colors"
          >
            Zur Karte
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors"
          >
            Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
