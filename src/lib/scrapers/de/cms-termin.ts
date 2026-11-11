/**
 * Ein Termin aus dem HTML eines CMS-Kalenders (TYPO3-Extensions, Contao),
 * fn-29.14. Gemeinsame Form der Parser in `contao.ts` und `typo3.ts`.
 */
export interface CmsTermin {
  /** Kennung des Termins auf der Website: Detailseite (Host + Pfad + Query), sonst Seite und Name. */
  key: string;
  /** Detailseite des Termins (absolut), wenn die Seite eine verlinkt. */
  url?: string;
  /** Kalendertag des Beginns in deutscher Ortszeit. */
  localDate: string;
  /** Instant (UTC, ISO) oder reines Datum bei ganztägigen Terminen. */
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  organizer?: string;
  description?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  lat?: number;
  lng?: number;
}
