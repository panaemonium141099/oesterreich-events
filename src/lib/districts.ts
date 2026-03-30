import type { District } from '@/types/events';

export interface DistrictInfo {
  name: District;
  center: [number, number]; // [lat, lng]
  postalCodes: string[];
}

export const DISTRICTS: DistrictInfo[] = [
  {
    name: 'Neusiedl am See',
    center: [47.95, 16.85],
    postalCodes: ['7100', '7121', '7122', '7131', '7132', '7141', '7142', '7143', '7152', '7161', '7162', '7163', '7164', '7165', '7171', '7181', '7182', '7183'],
  },
  {
    name: 'Eisenstadt',
    center: [47.85, 16.52],
    postalCodes: ['7000', '7011', '7013', '7021', '7022', '7023', '7024', '7031', '7032', '7033', '7034', '7035', '7041', '7051', '7052', '7053', '7061', '7062', '7063', '7064', '7071', '7072', '7081', '7082', '7083'],
  },
  {
    name: 'Mattersburg',
    center: [47.73, 16.40],
    postalCodes: ['7202', '7203', '7210', '7212', '7221', '7222', '7223', '7201', '7230', '7231', '7232', '7233', '7241', '7242', '7243', '7251', '7252', '7261', '7262', '7263'],
  },
  {
    name: 'Oberpullendorf',
    center: [47.50, 16.50],
    postalCodes: ['7301', '7302', '7304', '7311', '7312', '7321', '7322', '7323', '7331', '7332', '7341', '7342', '7343', '7350', '7361', '7371', '7372'],
  },
  {
    name: 'Oberwart',
    center: [47.29, 16.20],
    postalCodes: ['7400', '7410', '7411', '7412', '7421', '7422', '7423', '7431', '7432', '7433', '7434', '7435', '7441', '7442', '7443', '7444', '7451', '7452', '7453', '7461', '7463', '7471', '7472', '7473', '7474'],
  },
  {
    name: 'Güssing',
    center: [47.06, 16.32],
    postalCodes: ['7501', '7502', '7503', '7511', '7512', '7513', '7521', '7522', '7531', '7532', '7533', '7534', '7535', '7536', '7537', '7540', '7542', '7551', '7552', '7553', '7554', '7561', '7562', '7563', '7564'],
  },
  {
    name: 'Jennersdorf',
    center: [46.93, 16.14],
    postalCodes: ['8380', '8382', '8383', '8384', '8385', '8350', '8352', '8353', '8354', '8355'],
  },
];

export function getDistrictByPostalCode(postalCode: string): District | null {
  for (const district of DISTRICTS) {
    if (district.postalCodes.includes(postalCode)) {
      return district.name;
    }
  }
  return null;
}

export function getDistrictCenter(name: District): [number, number] | null {
  const district = DISTRICTS.find(d => d.name === name);
  return district?.center || null;
}

// Map location names to districts for reliable district assignment
const LOCATION_DISTRICT_MAP: Record<string, District> = {
  // Neusiedl am See
  'neusiedl': 'Neusiedl am See',
  'andau': 'Neusiedl am See',
  'frauenkirchen': 'Neusiedl am See',
  'gols': 'Neusiedl am See',
  'halbturn': 'Neusiedl am See',
  'illmitz': 'Neusiedl am See',
  'jois': 'Neusiedl am See',
  'kittsee': 'Neusiedl am See',
  'mönchhof': 'Neusiedl am See',
  'parndorf': 'Neusiedl am See',
  'podersdorf': 'Neusiedl am See',
  'weiden am see': 'Neusiedl am See',
  'apetlon': 'Neusiedl am See',
  'wallern': 'Neusiedl am See',
  'tadten': 'Neusiedl am See',
  'pamhagen': 'Neusiedl am See',
  'breitenbrunn': 'Neusiedl am See',
  'purbach': 'Neusiedl am See',
  'donnerskirchen': 'Neusiedl am See',
  'winden': 'Neusiedl am See',
  'nationalpark': 'Neusiedl am See',
  'seewinkel': 'Neusiedl am See',
  'familypark': 'Neusiedl am See',
  'gemeindeamt': 'Neusiedl am See',

  // Eisenstadt
  'eisenstadt': 'Eisenstadt',
  'rust': 'Eisenstadt',
  'oggau': 'Eisenstadt',
  'st. margarethen': 'Eisenstadt',
  'siegendorf': 'Eisenstadt',
  'hornstein': 'Eisenstadt',
  'neufeld': 'Eisenstadt',
  'müllendorf': 'Eisenstadt',
  'trausdorf': 'Eisenstadt',
  'oslip': 'Eisenstadt',
  'mörbisch': 'Eisenstadt',
  'schützen am gebirge': 'Eisenstadt',
  'haydn': 'Eisenstadt',
  'esterhazy': 'Eisenstadt',
  'esterházy': 'Eisenstadt',
  'landesgalerie': 'Eisenstadt',

  // Mattersburg
  'mattersburg': 'Mattersburg',
  'forchtenstein': 'Mattersburg',
  'bad sauerbrunn': 'Mattersburg',
  'draßburg': 'Mattersburg',
  'rohrbach': 'Mattersburg',
  'pöttsching': 'Mattersburg',
  'neudörfl': 'Mattersburg',
  'wiesen': 'Mattersburg',
  'zemendorf': 'Mattersburg',
  'sauerbrunn': 'Mattersburg',

  // Oberpullendorf
  'oberpullendorf': 'Oberpullendorf',
  'lackenbach': 'Oberpullendorf',
  'deutschkreutz': 'Oberpullendorf',
  'raiding': 'Oberpullendorf',
  'lockenhaus': 'Oberpullendorf',
  'kobersdorf': 'Oberpullendorf',
  'stoob': 'Oberpullendorf',
  'lutzmannsburg': 'Oberpullendorf',
  'sonnentherme': 'Oberpullendorf',
  'mannersdorf': 'Oberpullendorf',
  'liszt': 'Oberpullendorf',

  // Oberwart
  'oberwart': 'Oberwart',
  'bad tatzmannsdorf': 'Oberwart',
  'pinkafeld': 'Oberwart',
  'oberschützen': 'Oberwart',
  'stadtschlaining': 'Oberwart',
  'schlaining': 'Oberwart',
  'friedensburg': 'Oberwart',
  'bernstein': 'Oberwart',
  'markt allhau': 'Oberwart',
  'kemeten': 'Oberwart',
  'rechnitz': 'Oberwart',
  'großpetersdorf': 'Oberwart',

  // Güssing
  'güssing': 'Güssing',
  'stegersbach': 'Güssing',
  'heiligenkreuz': 'Güssing',
  'kukmirn': 'Güssing',
  'burgauberg': 'Güssing',
  'tobaj': 'Güssing',

  // Jennersdorf
  'jennersdorf': 'Jennersdorf',
  'neuhaus am klausenbach': 'Jennersdorf',
  'minihof': 'Jennersdorf',
  'mogersdorf': 'Jennersdorf',
  'mühlgraben': 'Jennersdorf',
  'naturpark raab': 'Jennersdorf',
};

export function getDistrictByLocation(locationName: string): District | null {
  if (!locationName) return null;
  const loc = locationName.toLowerCase();

  for (const [keyword, district] of Object.entries(LOCATION_DISTRICT_MAP)) {
    if (loc.includes(keyword)) {
      return district;
    }
  }
  return null;
}

export function getDistrictByCoordinates(lat: number, lng: number): District | null {
  // Burgenland district assignment based on lat/lng zones
  // The key insight: Burgenland is a narrow north-south strip, but districts
  // overlap in latitude, especially around the Neusiedler See area.

  // Neusiedl am See: north-east area, east of ~16.7 or north of 47.88
  if (lat > 47.88) return 'Neusiedl am See';
  if (lat > 47.75 && lng > 16.72) return 'Neusiedl am See'; // Illmitz, Podersdorf, Apetlon area

  // Eisenstadt: central-north, between lng 16.45-16.72
  if (lat > 47.78 && lng >= 16.45 && lng <= 16.72) return 'Eisenstadt';
  // Mörbisch, Rust, Oggau - south shore of Neusiedler See
  if (lat > 47.74 && lng > 16.60 && lng <= 16.72) return 'Eisenstadt';
  // St. Margarethen, Siegendorf area
  if (lat > 47.75 && lng >= 16.50 && lng <= 16.65) return 'Eisenstadt';

  // Mattersburg: west of Eisenstadt, lng < 16.50
  if (lat > 47.68 && lng < 16.50) return 'Mattersburg';

  // Oberpullendorf: central Burgenland
  if (lat > 47.40 && lat <= 47.68) return 'Oberpullendorf';

  // Oberwart: south-central
  if (lat > 47.15 && lat <= 47.40) return 'Oberwart';

  // Güssing
  if (lat > 46.95 && lat <= 47.15) return 'Güssing';

  // Jennersdorf: southernmost
  return 'Jennersdorf';
}
