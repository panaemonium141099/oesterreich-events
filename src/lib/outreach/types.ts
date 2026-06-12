export type ProspectKind = 'warm' | 'gemeinde' | 'media' | 'cold';
export type ProspectStatus =
  | 'discovered' | 'enriched' | 'drafted' | 'approved'
  | 'sent' | 'replied' | 'linked' | 'bounced' | 'skipped';

export interface ProspectCandidate {
  domain: string; // normalized
  kind: ProspectKind;
  orgName: string | null;
  website: string | null;
  bundesland: string | null;
  sourceEventIds: string[];
  discoveredVia: string; // e.g. 'warm:organizer_url'
}
