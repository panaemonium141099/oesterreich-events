/**
 * Entwicklungs-Hinweis der Startseite (fn-30.6): war ein Banner über dem
 * Kopf, jetzt eine Zeile im Footer (`Footer notice`). Der Text kommt aus
 * `Landing.devNotice`, die Adresse hängt als Link an.
 */

import { useTranslations } from 'next-intl';
import { getSite } from '@/lib/site';

export const DEV_CONTACT = getSite().contact.support;

export function DevNotice() {
  const t = useTranslations('Landing');
  return (
    <>
      {t('devNotice')}{' '}
      <a href={`mailto:${DEV_CONTACT}`} className="underline hover:text-white/50">{DEV_CONTACT}</a>.
    </>
  );
}
