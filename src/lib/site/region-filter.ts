/**
 * Spalte, über die diese Seite nach Region filtert (fn-31).
 *
 * lasstreffen.at filtert wie bisher über `bundesland` (neun IDs, CHECK).
 * lasstreffen.de über `region_id`: `bundesland` ist für deutsche Zeilen leer.
 * Beide Spalten haben einen Index mit dem Datum
 * (`idx_events_bundesland_start_published`, `idx_events_region_start_published`).
 * Der Länderfilter (`country`) bleibt daneben Pflicht.
 */
import { getSite } from './index';

export const REGION_COLUMN: 'bundesland' | 'region_id' = getSite().country === 'AT' ? 'bundesland' : 'region_id';
