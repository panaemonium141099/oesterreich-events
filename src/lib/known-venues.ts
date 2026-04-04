/**
 * Known venue coordinates for common Austrian locations.
 *
 * Shared module used by both the location normalizer (live sync path)
 * and geocoding.ts (Nominatim batch path). Single source of truth
 * to prevent drift between the two pipelines.
 */

export interface VenueCoords {
  latitude: number;
  longitude: number;
}

/**
 * Known Burgenland venue coordinates for common locations.
 * Keys are lowercase, matching is done via matchPlaceName() or normalizeString().
 */
export const KNOWN_VENUES: Record<string, VenueCoords> = {
  'kulturzentrum mattersburg': { latitude: 47.7351, longitude: 16.3988 },
  'kulturzentrum oberschützen': { latitude: 47.3536, longitude: 16.1988 },
  'friedensburg schlaining': { latitude: 47.3258, longitude: 16.2733 },
  'landesgalerie burgenland': { latitude: 47.8453, longitude: 16.5189 },
  'kulturzentrum eisenstadt': { latitude: 47.8453, longitude: 16.5189 },
  'schloss esterhazy': { latitude: 47.8458, longitude: 16.5182 },
  'burg forchtenstein': { latitude: 47.7081, longitude: 16.3283 },
  'schloss lackenbach': { latitude: 47.5862, longitude: 16.4673 },
  'haydn-haus eisenstadt': { latitude: 47.8456, longitude: 16.5213 },
  'joseph haydn privatschule': { latitude: 47.8445, longitude: 16.5207 },
  'kulturzentrum güssing': { latitude: 47.0567, longitude: 16.3237 },
  'burg güssing': { latitude: 47.0567, longitude: 16.3237 },
  'bad tatzmannsdorf': { latitude: 47.3344, longitude: 16.2258 },
  'sonnentherme lutzmannsburg': { latitude: 47.4627, longitude: 16.6465 },
  'familypark': { latitude: 47.7633, longitude: 16.7267 },
  'neusiedl am see': { latitude: 47.9480, longitude: 16.8438 },
  'rust': { latitude: 47.8003, longitude: 16.6710 },
  'mörbisch': { latitude: 47.7497, longitude: 16.6845 },
  'podersdorf': { latitude: 47.8554, longitude: 16.8307 },
  'illmitz': { latitude: 47.7689, longitude: 16.8028 },
  'frauenkirchen': { latitude: 47.8384, longitude: 16.9228 },
  'nationalpark neusiedler see': { latitude: 47.7700, longitude: 16.7680 },
  'oberwart': { latitude: 47.2896, longitude: 16.2066 },
  'jennersdorf': { latitude: 46.9381, longitude: 16.1448 },
  'pinkafeld': { latitude: 47.3730, longitude: 16.1222 },
  'stegersbach': { latitude: 47.1631, longitude: 16.1589 },
  'andau': { latitude: 47.7744, longitude: 17.0304 },
  'gols': { latitude: 47.8966, longitude: 16.9060 },
  'jois': { latitude: 47.9601, longitude: 16.7968 },
  'st. margarethen': { latitude: 47.7967, longitude: 16.5936 },
  'siegendorf': { latitude: 47.7792, longitude: 16.5511 },
  'raiding': { latitude: 47.5574, longitude: 16.5290 },
  'lockenhaus': { latitude: 47.4060, longitude: 16.4259 },
  'bernstein': { latitude: 47.3992, longitude: 16.2517 },
  'stadtschlaining': { latitude: 47.3258, longitude: 16.2733 },
  'therme laa': { latitude: 48.7167, longitude: 16.3833 },
  'seefestspiele moerbisch': { latitude: 47.7497, longitude: 16.6845 },
};
