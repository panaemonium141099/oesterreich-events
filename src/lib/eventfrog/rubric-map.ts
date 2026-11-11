import type { PrimaryCategory } from '@/lib/category-classifier/enrichment-taxonomy';
import { TAGS } from '@/lib/category-classifier/enrichment-taxonomy';
import type { EventfrogRubric } from './types';

/**
 * Eventfrog-Rubrik → unsere Primärkategorie (+ Tags).
 *
 * Eventfrog hat zwei Ebenen: 26 Oberrubriken (parentId 0) und ihre
 * Unterrubriken (Stand /public/v1/rubrics 2026-10-27, 343 Rubriken).
 * Die Rubrik wählt der Veranstalter selbst. Gesperrt (`locked`) wird die
 * Kategorie deshalb nur, wo die Rubrik eindeutig ist (Konzerte, Partys,
 * Märkte …). Mehrdeutige Rubriken („Freizeit & Ausflüge", „Kurse &
 * Seminare", „Diverses") gehen als Rohtext an den Classifier, der Titel
 * und Beschreibung mitliest. Tags nur aus dem kanonischen Vokabular.
 */
interface Entry {
  category: PrimaryCategory;
  tags?: string[];
}

/** Oberrubriken mit eindeutiger Zuordnung. Fehlt eine, entscheidet der Classifier. */
const PARENT: Record<number, Entry> = {
  900: { category: 'Community & Freizeit' },      // Dating
  901: { category: 'Essen & Trinken' },
  905: { category: 'Wellness & Spiritualität' },
  906: { category: 'Familie & Kinder' },
  907: { category: 'Musik', tags: ['klassik'] },   // Klassik & Opern
  908: { category: 'Musik', tags: ['live-konzert'] },
  909: { category: 'Kultur & Bühne', tags: ['ausstellung'] },
  911: { category: 'Märkte & Feste' },
  913: { category: 'Kultur & Bühne' },            // Musicals & Shows
  914: { category: 'Nightlife & Party' },
  916: { category: 'Sport & Bewegung' },
  917: { category: 'Kultur & Bühne', tags: ['theater'] },
  918: { category: 'Märkte & Feste' },            // Volksfeste
  919: { category: 'Wissen & Karriere' },
  922: { category: 'Kultur & Bühne', tags: ['comedy'] },
  923: { category: 'Kultur & Bühne' },            // Tanz
  924: { category: 'Kultur & Bühne', tags: ['kino'] },
  925: { category: 'Kultur & Bühne', tags: ['lesung'] },
};

/** Unterrubriken, die von ihrer Oberrubrik abweichen oder ein Genre tragen. */
const CHILD: Record<number, Partial<Entry>> = {
  // Festivals (903): Musik-Festivals eindeutig, Kunst/Theater/Literatur Bühne
  17: { category: 'Musik', tags: ['electro'] },
  20: { category: 'Musik', tags: ['hip-hop'] },
  21: { category: 'Musik', tags: ['jazz'] },
  22: { category: 'Kultur & Bühne' },
  23: { category: 'Kultur & Bühne', tags: ['oper'] },
  24: { category: 'Musik', tags: ['reggae'] },
  25: { category: 'Musik', tags: ['pop', 'rock'] },
  26: { category: 'Musik', tags: ['schlager'] },
  28: { category: 'Kultur & Bühne', tags: ['theater'] },
  1252: { category: 'Kultur & Bühne', tags: ['lesung'] },
  // Klassik & Opern (907): Oper ist bei uns Bühne (wie Eventim 2B)
  61: { category: 'Kultur & Bühne', tags: ['oper', 'operette'] },
  1236: { tags: ['kammermusik'] },
  // Konzerte (908)
  62: { tags: ['chor'] }, 63: { tags: ['blasmusik'] }, 64: { tags: ['chor'] },
  65: { tags: ['country'] }, 66: { tags: ['electro'] }, 67: { tags: ['folk'] },
  68: { tags: ['funk', 'soul'] }, 71: { tags: ['metal'] }, 72: { tags: ['hip-hop'] },
  73: { tags: ['house'] }, 74: { tags: ['indie', 'alternative'] }, 75: { tags: ['jazz'] },
  77: { tags: ['latin'] }, 78: { tags: ['open-mic'] }, 79: { tags: ['pop', 'rock'] },
  80: { tags: ['punk'] }, 81: { tags: ['reggae', 'ska'] }, 82: { tags: ['r-n-b'] },
  83: { tags: ['singer-songwriter'] }, 84: { tags: ['swing'] }, 85: { tags: ['techno'] },
  86: { tags: ['schlager', 'volksmusik'] }, 88: { tags: ['weltmusik'] }, 1244: { tags: ['bigband'] },
  // Partys (914)
  150: { category: 'Kultur & Bühne', tags: ['ball'] },
  154: { tags: ['electro'] }, 160: { tags: ['hip-hop'] }, 161: { tags: ['house', 'techno'] },
  164: { tags: ['karaoke'] }, 172: { tags: ['r-n-b'] }, 173: { tags: ['schlager'] },
  177: { tags: ['trance'] }, 1251: { tags: ['rave'] }, 252: { tags: ['goa'] },
  255: { tags: ['hardstyle'] }, 257: { tags: ['dubstep', 'dnb'] },
  // Kinderveranstaltungen (906)
  54: { tags: ['kindertheater'] }, 58: { tags: ['kindertheater'] },
  // Musicals & Shows (913): Zirkus wie Eventim 4C
  138: { tags: ['musical'] },
  143: { category: 'Familie & Kinder' },
  // Märkte (911)
  116: { tags: ['flohmarkt'] }, 117: { tags: ['flohmarkt'] }, 126: { tags: ['weihnachtsmarkt'] },
  // Sport & Fitness (916)
  192: { tags: ['eishockey'] }, 198: { tags: ['fussball'] }, 218: { tags: ['tennis'] },
  225: { category: 'Wellness & Spiritualität', tags: ['yoga'] },
  // Tanz (923)
  59: { tags: ['ballett'] },
  217: { category: 'Sport & Bewegung' },
  // Comedy (922)
  227: { tags: ['kabarett', 'comedy'] },
  // Lesung (925)
  234: { tags: ['poetry-slam'] },
};

const TAG_SET = new Set<string>(TAGS);

export interface RubricMapping {
  /** Primärkategorie, wenn eindeutig — sonst der Rohtext der Rubrik für den Classifier. */
  category?: string;
  locked: boolean;
  tags: string[];
}

export class RubricIndex {
  private readonly byId: Map<number, EventfrogRubric>;

  constructor(rubrics: EventfrogRubric[]) {
    this.byId = new Map(rubrics.map((r) => [r.id, r]));
  }

  private label(r: EventfrogRubric | undefined): string | undefined {
    return r ? (r.title.de ?? r.title.en ?? r.title.fr ?? undefined) || undefined : undefined;
  }

  map(rubricId: number): RubricMapping {
    const rubric = this.byId.get(rubricId);
    const parentId = rubric && rubric.parentId !== 0 ? rubric.parentId : rubricId;
    const child = rubric && rubric.parentId !== 0 ? CHILD[rubricId] : undefined;
    const parent = PARENT[parentId];
    const tags = [...new Set([...(parent?.tags ?? []), ...(child?.tags ?? [])])].filter((t) => TAG_SET.has(t));
    const category = child?.category ?? parent?.category;
    if (category) return { category, locked: true, tags };
    // Mehrdeutig: Rohtext „Ober: Unter" an den Classifier (source_category_raw).
    const raw = [this.label(this.byId.get(parentId)), rubric && rubric.parentId !== 0 ? this.label(rubric) : undefined]
      .filter(Boolean)
      .join(': ');
    return { category: raw || undefined, locked: false, tags };
  }
}
