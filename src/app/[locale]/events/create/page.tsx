import { permanentRedirect } from 'next/navigation';

/**
 * /events/create schrieb früher direkt aus dem Browser in `events`, an
 * Ortsentscheidung (Resolver) und Freigabe vorbei. Events kommen jetzt nur
 * noch über die Einreichung mit Admin-Freigabe (/event-inserieren), die
 * denselben Schreibweg wie die Scraper nutzt.
 */
export default function CreateEventPage() {
  permanentRedirect('/event-inserieren');
}
