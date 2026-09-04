import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('NotFound');
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="text-7xl font-bold text-slate-700 mb-2">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('title')}</h1>
        <p className="text-slate-400 mb-8">
          {t('description')}
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/map"
            className="px-6 py-3 bg-white text-slate-900 font-medium rounded-xl hover:bg-slate-100 transition-colors"
          >
            {t('toMap')}
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors"
          >
            {t('home')}
          </Link>
        </div>
      </div>
    </div>
  );
}
