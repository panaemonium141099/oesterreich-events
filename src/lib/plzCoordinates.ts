/**
 * PLZ → Koordinaten Mapping für ganz Österreich.
 * Jede PLZ wird dem Zentrum der zugehörigen Stadt/Gemeinde zugeordnet.
 * Das ermöglicht schnelles Geocoding ohne Nominatim-API.
 *
 * Format: PLZ → [latitude, longitude]
 * Quelle: Österreichische PLZ-Gebiete (Hauptorte)
 */

export const PLZ_COORDINATES: Record<string, [number, number]> = {
  // === WIEN (1xxx) ===
  '1010': [48.2082, 16.3738], // 1. Bezirk
  '1020': [48.2167, 16.4000], // Leopoldstadt
  '1030': [48.1986, 16.3953], // Landstraße
  '1040': [48.1921, 16.3713], // Wieden
  '1050': [48.1867, 16.3574], // Margareten
  '1060': [48.1963, 16.3477], // Mariahilf
  '1070': [48.2025, 16.3476], // Neubau
  '1080': [48.2106, 16.3492], // Josefstadt
  '1090': [48.2263, 16.3579], // Alsergrund
  '1100': [48.1681, 16.3847], // Favoriten
  '1110': [48.1644, 16.4208], // Simmering
  '1120': [48.1750, 16.3300], // Meidling
  '1130': [48.1775, 16.2700], // Hietzing
  '1140': [48.2025, 16.2817], // Penzing
  '1150': [48.1958, 16.3292], // Rudolfsheim-Fünfhaus
  '1160': [48.2117, 16.3208], // Ottakring
  '1170': [48.2267, 16.3183], // Hernals
  '1180': [48.2333, 16.3333], // Währing
  '1190': [48.2500, 16.3500], // Döbling
  '1200': [48.2333, 16.3750], // Brigittenau
  '1210': [48.2700, 16.4000], // Floridsdorf
  '1220': [48.2300, 16.4400], // Donaustadt
  '1230': [48.1450, 16.2950], // Liesing

  // === NIEDERÖSTERREICH (2xxx, 3xxx) ===
  '2000': [48.2043, 16.3677], // Stockerau
  '2100': [48.3380, 16.5000], // Korneuburg
  '2120': [48.4200, 16.6300], // Wolkersdorf
  '2130': [48.4600, 16.4900], // Mistelbach
  '2136': [48.5000, 16.5800], // Laa an der Thaya
  '2170': [48.6100, 16.6300], // Poysdorf
  '2230': [48.3100, 16.5500], // Gänserndorf
  '2232': [48.3300, 16.7200], // Deutsch-Wagram
  '2340': [48.0870, 16.2330], // Mödling
  '2344': [48.1100, 16.2800], // Maria Enzersdorf
  '2351': [48.0500, 16.2500], // Wr. Neudorf
  '2352': [48.0500, 16.2300], // Gumpoldskirchen
  '2353': [48.0200, 16.2600], // Guntramsdorf
  '2380': [48.0300, 16.2800], // Perchtoldsdorf
  '2400': [47.8097, 16.2419], // Wiener Neustadt
  '2440': [48.0400, 16.4400], // Gramatneusiedl
  '2460': [48.0600, 16.5200], // Bruck an der Leitha
  '2500': [47.9000, 16.2300], // Baden
  '2540': [47.9600, 16.1300], // Bad Vöslau
  '2620': [47.7000, 15.9600], // Neunkirchen
  '2630': [47.6800, 15.8500], // Ternitz
  '2640': [47.8000, 15.9400], // Gloggnitz
  '2700': [47.8100, 16.2400], // Wiener Neustadt
  '3100': [48.2000, 15.6333], // St. Pölten
  '3101': [48.2100, 15.6500], // St. Pölten
  '3130': [48.3100, 15.4300], // Herzogenburg
  '3150': [48.2200, 15.5100], // Wilhelmsburg
  '3170': [48.1100, 15.6700], // Hainfeld
  '3180': [48.1000, 15.5200], // Lilienfeld
  '3200': [48.0600, 15.2600], // Ober-Grafendorf (Bezirk St. Pölten-Land)
  '3300': [48.0900, 14.9700], // Amstetten
  '3340': [47.9600, 14.8800], // Waidhofen an der Ybbs
  '3350': [48.1200, 15.0400], // Haag
  '3390': [48.1800, 15.1000], // Melk
  '3400': [48.3300, 16.0500], // Klosterneuburg
  '3430': [48.3300, 15.8800], // Tulln
  '3500': [48.4100, 15.6100], // Krems
  '3504': [48.3900, 15.6500], // Krems-Stein
  '3508': [48.4600, 15.5900], // Paudorf
  '3541': [48.4700, 15.4100], // Senftenberg
  '3580': [48.6600, 15.6600], // Horn
  '3631': [48.4500, 15.0700], // Ottenschlag
  '3680': [48.7700, 15.2200], // Persenbeug
  '3710': [48.5100, 15.9300], // Ziersdorf
  '3730': [48.6500, 15.8600], // Eggenburg
  '3800': [48.5200, 15.3500], // Gmünd
  '3830': [48.8300, 15.2200], // Waidhofen/Thaya
  '3860': [48.6900, 15.1300], // Heidenreichstein
  '3910': [48.8400, 15.0100], // Zwettl

  // === OBERÖSTERREICH (4xxx) ===
  '4010': [48.3064, 14.2858], // Linz
  '4020': [48.3064, 14.2858], // Linz
  '4030': [48.2800, 14.2800], // Linz
  '4040': [48.3200, 14.2700], // Linz (Urfahr)
  '4050': [48.2500, 14.2500], // Traun
  '4060': [48.2800, 14.2300], // Leonding
  '4070': [48.3600, 14.1300], // Eferding
  '4100': [48.3400, 14.0300], // Ottensheim
  '4150': [48.4400, 14.1800], // Rohrbach
  '4170': [48.5800, 14.0300], // Haslach an der Mühl
  '4190': [48.5100, 14.4200], // Bad Leonfelden
  '4210': [48.5000, 14.5000], // Gallneukirchen
  '4240': [48.4600, 14.5500], // Freistadt
  '4300': [48.2500, 14.5200], // St. Valentin
  '4320': [48.3100, 14.6200], // Perg
  '4400': [48.1300, 14.0100], // Steyr
  '4470': [48.2100, 14.1500], // Enns
  '4481': [48.0700, 14.2400], // Asten
  '4490': [48.1600, 14.3200], // St. Florian
  '4600': [48.0600, 14.0200], // Wels
  '4614': [48.0900, 14.0900], // Marchtrenk
  '4650': [48.0800, 13.8200], // Lambach
  '4663': [48.0400, 13.8800], // Laakirchen
  '4690': [48.1500, 13.8200], // Schwanenstadt
  '4710': [48.2000, 13.8000], // Grieskirchen
  '4780': [48.2500, 13.4500], // Schärding
  '4810': [47.9400, 13.7700], // Gmunden
  '4820': [47.9100, 13.6200], // Bad Ischl
  '4840': [47.9900, 13.5800], // Vöcklabruck
  '4860': [47.9200, 13.5200], // Lenzing
  '4870': [48.0000, 13.4500], // Vöcklamarkt
  '4910': [48.2400, 13.4600], // Ried im Innkreis
  '4950': [48.0900, 13.0100], // Altheim
  '5020': [47.8000, 13.0400], // Salzburg-Stadt (listed under Salzburg)
  '5110': [47.9900, 13.0700], // Oberndorf bei Salzburg
  '5130': [48.0700, 12.9600], // Obertrum am See
  '5280': [48.0000, 13.0800], // Braunau am Inn

  // === STEIERMARK (8xxx) ===
  '8010': [47.0707, 15.4395], // Graz
  '8020': [47.0600, 15.4300], // Graz
  '8036': [47.0400, 15.4700], // Graz
  '8041': [47.0400, 15.4300], // Graz-Liebenau
  '8042': [47.0400, 15.4800], // Graz-St. Peter
  '8045': [47.0300, 15.4600], // Graz-Andritz
  '8051': [47.0800, 15.3900], // Graz-Gösting
  '8053': [47.0900, 15.4100], // Graz-Wetzelsdorf
  '8055': [47.0500, 15.4000], // Graz-Puntigam
  '8063': [47.1200, 15.5400], // Eggersdorf
  '8100': [47.0700, 15.2700], // Gleisdorf (Bezirk Weiz)
  '8130': [47.2200, 15.3500], // Frohnleiten
  '8160': [47.2000, 15.2700], // Weiz
  '8200': [47.1800, 15.6800], // Gleisdorf
  '8230': [47.2000, 15.8800], // Hartberg
  '8280': [47.0700, 15.8800], // Fürstenfeld
  '8311': [46.8800, 15.6300], // Markt Hartmannsdorf
  '8330': [46.8800, 15.8000], // Feldbach
  '8350': [46.9400, 16.1400], // Jennersdorf (Burgenland)
  '8430': [46.8500, 15.2000], // Leibnitz
  '8461': [46.7500, 15.4800], // Ehrenhausen
  '8490': [46.8100, 15.3200], // Bad Radkersburg
  '8530': [46.8800, 15.2200], // Deutschlandsberg
  '8570': [46.9600, 15.0700], // Voitsberg
  '8600': [47.3800, 15.0900], // Bruck an der Mur
  '8605': [47.4200, 15.2700], // Kapfenberg
  '8630': [47.3600, 15.0700], // Mariazell
  '8650': [47.3700, 15.3500], // Kindberg
  '8680': [47.5500, 15.6100], // Mürzzuschlag
  '8700': [47.3700, 15.0900], // Leoben
  '8720': [47.3800, 14.8100], // Knittelfeld
  '8750': [47.3500, 14.6800], // Judenburg
  '8790': [47.3600, 14.5200], // Eisenerz
  '8820': [47.2600, 14.2300], // Neumarkt in Steiermark
  '8850': [47.1200, 14.1500], // Murau
  '8900': [47.4700, 14.0900], // Selzthal
  '8940': [47.3800, 14.0800], // Liezen
  '8950': [47.3300, 13.6900], // Stainach
  '8970': [47.3900, 13.6900], // Schladming

  // === SALZBURG (5xxx) ===
  '5023': [47.8100, 13.0600], // Salzburg-Süd
  '5026': [47.8100, 13.0200], // Salzburg-Aigen
  '5061': [47.8400, 12.9800], // Elsbethen
  '5071': [47.7800, 13.1100], // Wals-Siezenheim
  '5081': [47.7600, 13.0200], // Anif
  '5101': [47.7500, 12.9600], // Bergheim
  '5400': [47.4900, 13.1100], // Hallein
  '5500': [47.3500, 13.2000], // Bischofshofen
  '5541': [47.3800, 13.2700], // Altenmarkt im Pongau
  '5542': [47.3800, 13.2000], // Flachau
  '5550': [47.3200, 13.1200], // Radstadt
  '5580': [47.3000, 13.2500], // Tamsweg
  '5620': [47.5000, 13.1500], // Schwarzach im Pongau
  '5640': [47.4700, 13.0000], // Bad Hofgastein
  '5660': [47.1300, 13.0500], // Taxenbach
  '5700': [47.3200, 12.8000], // Zell am See
  '5710': [47.3500, 12.7500], // Kaprun
  '5730': [47.2500, 12.3600], // Mittersill
  '5741': [47.2700, 12.5600], // Neukirchen am Großvenediger
  '5760': [47.2400, 13.0100], // Saalfelden

  // === KÄRNTEN (9xxx) ===
  '9020': [46.6247, 14.3089], // Klagenfurt
  '9073': [46.6000, 14.2200], // Viktring
  '9100': [46.6200, 14.6200], // Völkermarkt
  '9130': [46.5700, 14.1200], // Poggersdorf
  '9150': [46.5800, 14.6400], // Bleiburg
  '9170': [46.6600, 14.7200], // Ferlach
  '9201': [46.7200, 14.1000], // Krumpendorf
  '9210': [46.7800, 14.0400], // Pörtschach am Wörthersee
  '9220': [46.7500, 13.8500], // Velden am Wörthersee
  '9300': [46.7300, 14.5100], // St. Veit an der Glan
  '9330': [46.8300, 14.3600], // Althofen
  '9400': [46.5600, 14.4200], // Wolfsberg
  '9462': [46.6200, 14.8400], // Bad St. Leonhard
  '9500': [46.6130, 13.8500], // Villach
  '9504': [46.5800, 13.9300], // Warmbad Villach
  '9520': [46.6800, 13.8800], // Annenheim
  '9530': [46.7100, 13.7000], // Bad Bleiberg
  '9560': [46.7300, 13.5100], // Feldkirchen
  '9580': [46.8000, 13.6500], // Villach-Land
  '9601': [46.6800, 13.4200], // Arnoldstein
  '9620': [46.6200, 13.2200], // Hermagor
  '9640': [46.4500, 13.0000], // Kötschach-Mauthen
  '9800': [46.7500, 13.3500], // Spittal an der Drau
  '9821': [46.8600, 13.3300], // Obervellach
  '9844': [47.0000, 13.3700], // Heiligenblut
  '9900': [46.8300, 12.7700], // Lienz

  // === TIROL (6xxx) ===
  '6010': [47.2654, 11.3928], // Innsbruck
  '6020': [47.2654, 11.3928], // Innsbruck
  '6060': [47.2600, 11.4600], // Hall in Tirol
  '6080': [47.2200, 11.4600], // Innsbruck-Igls
  '6100': [47.2700, 11.4900], // Seefeld in Tirol
  '6112': [47.2900, 11.5600], // Wattens
  '6130': [47.2300, 11.7400], // Schwaz
  '6150': [47.1400, 11.2500], // Steinach am Brenner
  '6170': [47.3400, 11.7800], // Zirl
  '6176': [47.1700, 11.7000], // Völs
  '6200': [47.3100, 11.8900], // Jenbach
  '6210': [47.3700, 11.8900], // Wiesing (Zillertal)
  '6212': [47.0300, 11.8700], // Maurach am Achensee
  '6215': [47.1800, 11.8800], // Achenkirch
  '6250': [47.2900, 11.8700], // Kundl
  '6263': [47.2000, 11.8000], // Fügen (Zillertal)
  '6271': [47.0600, 11.8700], // Uderns (Zillertal)
  '6280': [47.3100, 12.1200], // Zell am Ziller
  '6290': [47.1400, 11.8600], // Mayrhofen
  '6300': [47.4500, 12.1600], // Wörgl
  '6330': [47.4500, 12.0200], // Kufstein
  '6343': [47.5300, 12.1400], // Erl
  '6345': [47.4400, 12.2200], // Kössen
  '6370': [47.4500, 12.3900], // Kitzbühel
  '6380': [47.4500, 12.3300], // St. Johann in Tirol
  '6391': [47.4500, 12.5800], // Fieberbrunn
  '6410': [47.3100, 11.1200], // Telfs
  '6450': [47.2400, 10.7400], // Sölden
  '6460': [47.2700, 11.0500], // Imst
  '6500': [47.2700, 10.7100], // Landeck
  '6511': [47.2700, 10.5400], // Zams
  '6533': [47.0800, 10.4400], // Fiss/Serfaus
  '6534': [47.0400, 10.2000], // Serfaus
  '6561': [47.1500, 10.2600], // Ischgl
  '6580': [47.3200, 10.4300], // St. Anton am Arlberg
  '6600': [47.4800, 10.7100], // Reutte
  '6631': [47.4200, 10.5700], // Lermoos
  '6632': [47.4100, 10.5800], // Ehrwald

  // === VORARLBERG (67xx, 68xx, 69xx) ===
  '6700': [47.2000, 9.8000], // Bludenz
  '6710': [47.0800, 10.1100], // Nenzing (Walgau)
  '6712': [47.2100, 9.8200], // Thüringen
  '6714': [47.1300, 10.0200], // Nüziders
  '6719': [47.0500, 9.8600], // Bludesch
  '6731': [47.1200, 10.2300], // Sonntag (Großes Walsertal)
  '6741': [47.1500, 10.0000], // Raggal
  '6752': [47.2300, 10.2100], // Dalaas
  '6762': [47.1100, 9.9200], // Stuben am Arlberg
  '6763': [47.1300, 10.2200], // Zürs am Arlberg
  '6764': [47.2100, 10.1500], // Lech am Arlberg
  '6774': [47.1300, 10.1300], // Tschagguns (Montafon)
  '6780': [47.0800, 10.0000], // Schruns (Montafon)
  '6787': [47.0100, 10.0800], // Gargellen
  '6791': [47.2100, 9.8800], // St. Gallenkirch
  '6800': [47.2400, 9.7400], // Feldkirch
  '6820': [47.2800, 9.6500], // Frastanz
  '6830': [47.3300, 9.6400], // Rankweil
  '6840': [47.3500, 9.7300], // Götzis
  '6845': [47.3400, 9.7400], // Hohenems
  '6850': [47.4100, 9.7400], // Dornbirn
  '6858': [47.4100, 9.6600], // Schwarzach
  '6860': [47.3500, 9.6600], // Alberschwende
  '6863': [47.3400, 9.6200], // Egg (Bregenzerwald)
  '6870': [47.3800, 9.7000], // Bezau (Bregenzerwald)
  '6881': [47.5300, 9.9400], // Mellau
  '6886': [47.3800, 10.0500], // Schoppernau
  '6890': [47.4000, 9.9300], // Lustenau
  '6900': [47.5000, 9.7500], // Bregenz
  '6911': [47.4800, 9.7000], // Lochau
  '6921': [47.4600, 9.6100], // Kennelbach
  '6922': [47.5100, 9.6100], // Wolfurt
  '6923': [47.5200, 9.5500], // Lauterach
  '6924': [47.5100, 9.4900], // Gaißau/Fußach
  '6941': [47.4100, 9.5600], // Langenegg
  '6942': [47.4500, 9.5600], // Krumbach
  '6951': [47.5300, 10.0700], // Lingenau
  '6952': [47.4400, 9.6700], // Hittisau
  '6960': [47.5000, 9.6000], // Buch (Bregenzerwald)
  '6971': [47.5100, 9.7100], // Hard
  '6991': [47.4700, 9.8600], // Riezlern (Kleinwalsertal)
};

/**
 * Get coordinates for a PLZ. Returns [lat, lng] or null.
 */
export function getCoordinatesForPLZ(plz: string): [number, number] | null {
  if (!plz) return null;
  const cleaned = plz.trim().slice(0, 4);
  return PLZ_COORDINATES[cleaned] || null;
}

/**
 * Get Bundesland from PLZ prefix.
 */
export function getBundeslandFromPLZ(plz: string): string | null {
  if (!plz) return null;
  const first = parseInt(plz.charAt(0));
  const firstTwo = parseInt(plz.slice(0, 2));

  if (first === 1) return 'wien';
  if (first === 2 || first === 3) return 'niederoesterreich';
  if (first === 4) return 'oberoesterreich';
  if (firstTwo >= 50 && firstTwo <= 57) return 'salzburg';
  if (firstTwo >= 60 && firstTwo <= 66) return 'tirol';
  if (firstTwo >= 67 && firstTwo <= 69) return 'vorarlberg';
  if (firstTwo >= 70 && firstTwo <= 78) return 'burgenland';
  if (first === 8) return 'steiermark';
  if (first === 9) return 'kaernten';

  return null;
}
