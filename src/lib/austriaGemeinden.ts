/**
 * Comprehensive Austrian Bezirk (district) and Gemeinde (municipality) coordinate database.
 * Contains all 94 political districts and the ~200 largest municipalities.
 * Keys are lowercase slugs as used in meinbezirk.at URLs.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BezirkInfo {
  lat: number;
  lng: number;
  bundesland: string;
}

export interface GemeindeInfo {
  lat: number;
  lng: number;
  bezirk: string;
  bundesland: string;
}

// ─── BEZIRK_COORDINATES ────────────────────────────────────────────────────
// All 94 political districts of Austria.
// Coordinates point to the Bezirkshauptstadt (district capital).
// Keys are lowercase URL-slugs (meinbezirk.at style).

export const BEZIRK_COORDINATES: Record<string, BezirkInfo> = {
  // ── Burgenland (7 Bezirke) ──────────────────────────────────────────────
  'eisenstadt': { lat: 47.8457, lng: 16.5233, bundesland: 'Burgenland' },
  'eisenstadt-umgebung': { lat: 47.8457, lng: 16.5233, bundesland: 'Burgenland' },
  'rust': { lat: 47.8012, lng: 16.6716, bundesland: 'Burgenland' },
  'mattersburg': { lat: 47.7317, lng: 16.4003, bundesland: 'Burgenland' },
  'oberpullendorf': { lat: 47.5013, lng: 16.5055, bundesland: 'Burgenland' },
  'oberwart': { lat: 47.2917, lng: 16.2069, bundesland: 'Burgenland' },
  'guessing': { lat: 47.0578, lng: 16.3222, bundesland: 'Burgenland' },
  'güssing': { lat: 47.0578, lng: 16.3222, bundesland: 'Burgenland' },
  'jennersdorf': { lat: 46.9383, lng: 16.1425, bundesland: 'Burgenland' },
  'neusiedl-am-see': { lat: 47.9474, lng: 16.8454, bundesland: 'Burgenland' },

  // ── Kärnten (10 Bezirke) ────────────────────────────────────────────────
  'klagenfurt': { lat: 46.6247, lng: 14.3053, bundesland: 'Kärnten' },
  'klagenfurt-land': { lat: 46.6247, lng: 14.3053, bundesland: 'Kärnten' },
  'villach': { lat: 46.6103, lng: 13.8558, bundesland: 'Kärnten' },
  'villach-land': { lat: 46.6103, lng: 13.8558, bundesland: 'Kärnten' },
  'hermagor': { lat: 46.6268, lng: 13.3702, bundesland: 'Kärnten' },
  'spittal': { lat: 46.7982, lng: 13.4963, bundesland: 'Kärnten' },
  'spittal-an-der-drau': { lat: 46.7982, lng: 13.4963, bundesland: 'Kärnten' },
  'feldkirchen': { lat: 46.7237, lng: 14.0958, bundesland: 'Kärnten' },
  'st-veit': { lat: 46.7681, lng: 14.3603, bundesland: 'Kärnten' },
  'st-veit-an-der-glan': { lat: 46.7681, lng: 14.3603, bundesland: 'Kärnten' },
  'voelkermarkt': { lat: 46.6613, lng: 14.6350, bundesland: 'Kärnten' },
  'völkermarkt': { lat: 46.6613, lng: 14.6350, bundesland: 'Kärnten' },
  'wolfsberg': { lat: 46.8391, lng: 14.8452, bundesland: 'Kärnten' },

  // ── Niederösterreich (25 Bezirke) ───────────────────────────────────────
  'st-poelten': { lat: 48.2000, lng: 15.6333, bundesland: 'Niederösterreich' },
  'st-poelten-land': { lat: 48.2000, lng: 15.6333, bundesland: 'Niederösterreich' },
  'amstetten': { lat: 48.1229, lng: 14.8721, bundesland: 'Niederösterreich' },
  'baden': { lat: 48.0054, lng: 16.2326, bundesland: 'Niederösterreich' },
  'bruck-an-der-leitha': { lat: 48.0238, lng: 16.7753, bundesland: 'Niederösterreich' },
  'gaenserndorf': { lat: 48.3393, lng: 16.7202, bundesland: 'Niederösterreich' },
  'gänserndorf': { lat: 48.3393, lng: 16.7202, bundesland: 'Niederösterreich' },
  'gmuend': { lat: 48.7683, lng: 14.9833, bundesland: 'Niederösterreich' },
  'gmünd': { lat: 48.7683, lng: 14.9833, bundesland: 'Niederösterreich' },
  'hollabrunn': { lat: 48.5500, lng: 16.0833, bundesland: 'Niederösterreich' },
  'horn': { lat: 48.6594, lng: 15.6597, bundesland: 'Niederösterreich' },
  'korneuburg': { lat: 48.3447, lng: 16.3315, bundesland: 'Niederösterreich' },
  'krems': { lat: 48.4100, lng: 15.6038, bundesland: 'Niederösterreich' },
  'krems-land': { lat: 48.4100, lng: 15.6038, bundesland: 'Niederösterreich' },
  'lilienfeld': { lat: 48.0133, lng: 15.5981, bundesland: 'Niederösterreich' },
  'melk': { lat: 48.2274, lng: 15.3319, bundesland: 'Niederösterreich' },
  'mistelbach': { lat: 48.5700, lng: 16.5767, bundesland: 'Niederösterreich' },
  'moedling': { lat: 48.0861, lng: 16.2892, bundesland: 'Niederösterreich' },
  'mödling': { lat: 48.0861, lng: 16.2892, bundesland: 'Niederösterreich' },
  'neunkirchen': { lat: 47.7210, lng: 16.0808, bundesland: 'Niederösterreich' },
  'scheibbs': { lat: 48.0044, lng: 15.1681, bundesland: 'Niederösterreich' },
  'tulln': { lat: 48.3312, lng: 16.0518, bundesland: 'Niederösterreich' },
  'waidhofen': { lat: 48.8146, lng: 15.2845, bundesland: 'Niederösterreich' },
  'waidhofen-an-der-thaya': { lat: 48.8146, lng: 15.2845, bundesland: 'Niederösterreich' },
  'waidhofen-an-der-ybbs': { lat: 47.9553, lng: 14.7750, bundesland: 'Niederösterreich' },
  'wr-neustadt': { lat: 47.8028, lng: 16.2332, bundesland: 'Niederösterreich' },
  'wiener-neustadt': { lat: 47.8028, lng: 16.2332, bundesland: 'Niederösterreich' },
  'wiener-neustadt-land': { lat: 47.8028, lng: 16.2332, bundesland: 'Niederösterreich' },
  'zwettl': { lat: 48.6053, lng: 15.1659, bundesland: 'Niederösterreich' },

  // ── Oberösterreich (18 Bezirke) ─────────────────────────────────────────
  'enns': { lat: 48.2125, lng: 14.4750, bundesland: 'Oberösterreich' },
  'linz': { lat: 48.3064, lng: 14.2861, bundesland: 'Oberösterreich' },
  'linz-land': { lat: 48.3064, lng: 14.2861, bundesland: 'Oberösterreich' },
  'wels': { lat: 48.1575, lng: 14.0289, bundesland: 'Oberösterreich' },
  'wels-land': { lat: 48.1575, lng: 14.0289, bundesland: 'Oberösterreich' },
  'steyr': { lat: 48.0381, lng: 14.4214, bundesland: 'Oberösterreich' },
  'steyr-steyr-land': { lat: 48.0381, lng: 14.4214, bundesland: 'Oberösterreich' },
  'steyr-land': { lat: 48.0381, lng: 14.4214, bundesland: 'Oberösterreich' },
  'braunau': { lat: 48.2563, lng: 13.0434, bundesland: 'Oberösterreich' },
  'braunau-am-inn': { lat: 48.2563, lng: 13.0434, bundesland: 'Oberösterreich' },
  'eferding': { lat: 48.3089, lng: 13.9753, bundesland: 'Oberösterreich' },
  'freistadt': { lat: 48.5117, lng: 14.5050, bundesland: 'Oberösterreich' },
  'gmunden': { lat: 47.9186, lng: 13.8003, bundesland: 'Oberösterreich' },
  'grieskirchen': { lat: 48.2333, lng: 13.8333, bundesland: 'Oberösterreich' },
  'kirchdorf': { lat: 47.9063, lng: 14.1198, bundesland: 'Oberösterreich' },
  'kirchdorf-an-der-krems': { lat: 47.9063, lng: 14.1198, bundesland: 'Oberösterreich' },
  'perg': { lat: 48.2450, lng: 14.6361, bundesland: 'Oberösterreich' },
  'ried': { lat: 48.2100, lng: 13.4893, bundesland: 'Oberösterreich' },
  'ried-im-innkreis': { lat: 48.2100, lng: 13.4893, bundesland: 'Oberösterreich' },
  'rohrbach': { lat: 48.5724, lng: 13.9892, bundesland: 'Oberösterreich' },
  'schaerding': { lat: 48.4580, lng: 13.4316, bundesland: 'Oberösterreich' },
  'schärding': { lat: 48.4580, lng: 13.4316, bundesland: 'Oberösterreich' },
  'urfahr-umgebung': { lat: 48.3297, lng: 14.2878, bundesland: 'Oberösterreich' },
  'voecklabruck': { lat: 48.0033, lng: 13.6561, bundesland: 'Oberösterreich' },
  'vöcklabruck': { lat: 48.0033, lng: 13.6561, bundesland: 'Oberösterreich' },

  // ── Salzburg (6 Bezirke) ────────────────────────────────────────────────
  'salzburg': { lat: 47.7994, lng: 13.0440, bundesland: 'Salzburg' },
  'salzburg-stadt': { lat: 47.7994, lng: 13.0440, bundesland: 'Salzburg' },
  'salzburg-umgebung': { lat: 47.7994, lng: 13.0440, bundesland: 'Salzburg' },
  'hallein': { lat: 47.6825, lng: 13.1004, bundesland: 'Salzburg' },
  'st-johann-im-pongau': { lat: 47.3476, lng: 13.2150, bundesland: 'Salzburg' },
  'st-johann': { lat: 47.3476, lng: 13.2150, bundesland: 'Salzburg' },
  'tamsweg': { lat: 47.1296, lng: 13.8104, bundesland: 'Salzburg' },
  'lungau': { lat: 47.1296, lng: 13.8104, bundesland: 'Salzburg' },
  'zell-am-see': { lat: 47.3235, lng: 12.7969, bundesland: 'Salzburg' },

  // ── Steiermark (13 Bezirke) ─────────────────────────────────────────────
  'graz': { lat: 47.0707, lng: 15.4395, bundesland: 'Steiermark' },
  'graz-umgebung': { lat: 47.0707, lng: 15.4395, bundesland: 'Steiermark' },
  'bruck-an-der-mur': { lat: 47.4099, lng: 15.2686, bundesland: 'Steiermark' },
  'bruck-muerzzuschlag': { lat: 47.4099, lng: 15.2686, bundesland: 'Steiermark' },
  'deutschlandsberg': { lat: 46.8146, lng: 15.2138, bundesland: 'Steiermark' },
  'hartberg': { lat: 47.2815, lng: 15.9730, bundesland: 'Steiermark' },
  'hartberg-fuerstenfeld': { lat: 47.2815, lng: 15.9730, bundesland: 'Steiermark' },
  'leibnitz': { lat: 46.7816, lng: 15.5384, bundesland: 'Steiermark' },
  'leoben': { lat: 47.3765, lng: 15.0914, bundesland: 'Steiermark' },
  'liezen': { lat: 47.5674, lng: 14.2432, bundesland: 'Steiermark' },
  'murau': { lat: 47.1130, lng: 14.1690, bundesland: 'Steiermark' },
  'murtal': { lat: 47.2100, lng: 14.6850, bundesland: 'Steiermark' },
  'suedoststeiermark': { lat: 46.7231, lng: 15.8831, bundesland: 'Steiermark' },
  'voitsberg': { lat: 47.0505, lng: 15.1475, bundesland: 'Steiermark' },
  'weiz': { lat: 47.2167, lng: 15.6222, bundesland: 'Steiermark' },

  // ── Tirol (9 Bezirke) ──────────────────────────────────────────────────
  'innsbruck': { lat: 47.2627, lng: 11.3946, bundesland: 'Tirol' },
  'innsbruck-land': { lat: 47.2627, lng: 11.3946, bundesland: 'Tirol' },
  'imst': { lat: 47.2450, lng: 10.7397, bundesland: 'Tirol' },
  'kitzbuehel': { lat: 47.4464, lng: 12.3922, bundesland: 'Tirol' },
  'kitzbühel': { lat: 47.4464, lng: 12.3922, bundesland: 'Tirol' },
  'kufstein': { lat: 47.5833, lng: 12.1667, bundesland: 'Tirol' },
  'landeck': { lat: 47.1397, lng: 10.5678, bundesland: 'Tirol' },
  'lienz': { lat: 46.8289, lng: 12.7690, bundesland: 'Tirol' },
  'reutte': { lat: 47.4854, lng: 10.7181, bundesland: 'Tirol' },
  'schwaz': { lat: 47.3519, lng: 11.7100, bundesland: 'Tirol' },

  // ── Vorarlberg (4 Bezirke) ──────────────────────────────────────────────
  'bludenz': { lat: 47.1549, lng: 9.8224, bundesland: 'Vorarlberg' },
  'bregenz': { lat: 47.5031, lng: 9.7471, bundesland: 'Vorarlberg' },
  'dornbirn': { lat: 47.4143, lng: 9.7420, bundesland: 'Vorarlberg' },
  'feldkirch': { lat: 47.2378, lng: 9.5981, bundesland: 'Vorarlberg' },

  // ── Wien (1 Bezirk als Gesamtstadt) ─────────────────────────────────────
  'wien': { lat: 48.2082, lng: 16.3738, bundesland: 'Wien' },
};

// ─── GEMEINDE_COORDINATES ──────────────────────────────────────────────────
// The ~200 largest municipalities of Austria (cities with >5000 inhabitants).
// Keys are lowercase slugs.

export const GEMEINDE_COORDINATES: Record<string, GemeindeInfo> = {
  // ── Wien ──────────────────────────────────────────────────────────────────
  'wien': { lat: 48.2082, lng: 16.3738, bezirk: 'Wien', bundesland: 'Wien' },

  // ── Burgenland ────────────────────────────────────────────────────────────
  'eisenstadt': { lat: 47.8457, lng: 16.5233, bezirk: 'Eisenstadt', bundesland: 'Burgenland' },
  'oberwart': { lat: 47.2917, lng: 16.2069, bezirk: 'Oberwart', bundesland: 'Burgenland' },
  'neusiedl-am-see': { lat: 47.9474, lng: 16.8454, bezirk: 'Neusiedl am See', bundesland: 'Burgenland' },
  'mattersburg': { lat: 47.7317, lng: 16.4003, bezirk: 'Mattersburg', bundesland: 'Burgenland' },
  'oberpullendorf': { lat: 47.5013, lng: 16.5055, bezirk: 'Oberpullendorf', bundesland: 'Burgenland' },
  'guessing': { lat: 47.0578, lng: 16.3222, bezirk: 'Güssing', bundesland: 'Burgenland' },
  'jennersdorf': { lat: 46.9383, lng: 16.1425, bezirk: 'Jennersdorf', bundesland: 'Burgenland' },
  'pinkafeld': { lat: 47.3736, lng: 16.1231, bezirk: 'Oberwart', bundesland: 'Burgenland' },
  'rust': { lat: 47.8012, lng: 16.6716, bezirk: 'Eisenstadt-Umgebung', bundesland: 'Burgenland' },

  // ── Kärnten ───────────────────────────────────────────────────────────────
  'klagenfurt': { lat: 46.6247, lng: 14.3053, bezirk: 'Klagenfurt', bundesland: 'Kärnten' },
  'villach': { lat: 46.6103, lng: 13.8558, bezirk: 'Villach', bundesland: 'Kärnten' },
  'wolfsberg': { lat: 46.8391, lng: 14.8452, bezirk: 'Wolfsberg', bundesland: 'Kärnten' },
  'spittal-an-der-drau': { lat: 46.7982, lng: 13.4963, bezirk: 'Spittal an der Drau', bundesland: 'Kärnten' },
  'st-veit-an-der-glan': { lat: 46.7681, lng: 14.3603, bezirk: 'Sankt Veit an der Glan', bundesland: 'Kärnten' },
  'voelkermarkt': { lat: 46.6613, lng: 14.6350, bezirk: 'Völkermarkt', bundesland: 'Kärnten' },
  'feldkirchen-in-kaernten': { lat: 46.7237, lng: 14.0958, bezirk: 'Feldkirchen', bundesland: 'Kärnten' },
  'hermagor': { lat: 46.6268, lng: 13.3702, bezirk: 'Hermagor', bundesland: 'Kärnten' },
  'ferlach': { lat: 46.5256, lng: 14.3003, bezirk: 'Klagenfurt-Land', bundesland: 'Kärnten' },
  'althofen': { lat: 46.8725, lng: 14.4731, bezirk: 'Sankt Veit an der Glan', bundesland: 'Kärnten' },
  'st-andrae': { lat: 46.7694, lng: 14.8222, bezirk: 'Wolfsberg', bundesland: 'Kärnten' },
  'bleiburg': { lat: 46.5903, lng: 14.7983, bezirk: 'Völkermarkt', bundesland: 'Kärnten' },

  // ── Niederösterreich ──────────────────────────────────────────────────────
  'st-poelten': { lat: 48.2000, lng: 15.6333, bezirk: 'Sankt Pölten', bundesland: 'Niederösterreich' },
  'wiener-neustadt': { lat: 47.8028, lng: 16.2332, bezirk: 'Wiener Neustadt', bundesland: 'Niederösterreich' },
  'krems-an-der-donau': { lat: 48.4100, lng: 15.6038, bezirk: 'Krems', bundesland: 'Niederösterreich' },
  'amstetten': { lat: 48.1229, lng: 14.8721, bezirk: 'Amstetten', bundesland: 'Niederösterreich' },
  'baden': { lat: 48.0054, lng: 16.2326, bezirk: 'Baden', bundesland: 'Niederösterreich' },
  'moedling': { lat: 48.0861, lng: 16.2892, bezirk: 'Mödling', bundesland: 'Niederösterreich' },
  'korneuburg': { lat: 48.3447, lng: 16.3315, bezirk: 'Korneuburg', bundesland: 'Niederösterreich' },
  'tulln-an-der-donau': { lat: 48.3312, lng: 16.0518, bezirk: 'Tulln', bundesland: 'Niederösterreich' },
  'tulln': { lat: 48.3312, lng: 16.0518, bezirk: 'Tulln', bundesland: 'Niederösterreich' },
  'hollabrunn': { lat: 48.5500, lng: 16.0833, bezirk: 'Hollabrunn', bundesland: 'Niederösterreich' },
  'mistelbach': { lat: 48.5700, lng: 16.5767, bezirk: 'Mistelbach', bundesland: 'Niederösterreich' },
  'gaenserndorf': { lat: 48.3393, lng: 16.7202, bezirk: 'Gänserndorf', bundesland: 'Niederösterreich' },
  'zwettl': { lat: 48.6053, lng: 15.1659, bezirk: 'Zwettl', bundesland: 'Niederösterreich' },
  'melk': { lat: 48.2274, lng: 15.3319, bezirk: 'Melk', bundesland: 'Niederösterreich' },
  'neunkirchen': { lat: 47.7210, lng: 16.0808, bezirk: 'Neunkirchen', bundesland: 'Niederösterreich' },
  'horn': { lat: 48.6594, lng: 15.6597, bezirk: 'Horn', bundesland: 'Niederösterreich' },
  'scheibbs': { lat: 48.0044, lng: 15.1681, bezirk: 'Scheibbs', bundesland: 'Niederösterreich' },
  'lilienfeld': { lat: 48.0133, lng: 15.5981, bezirk: 'Lilienfeld', bundesland: 'Niederösterreich' },
  'waidhofen-an-der-thaya': { lat: 48.8146, lng: 15.2845, bezirk: 'Waidhofen an der Thaya', bundesland: 'Niederösterreich' },
  'waidhofen-an-der-ybbs': { lat: 47.9553, lng: 14.7750, bezirk: 'Waidhofen an der Ybbs', bundesland: 'Niederösterreich' },
  'bruck-an-der-leitha': { lat: 48.0238, lng: 16.7753, bezirk: 'Bruck an der Leitha', bundesland: 'Niederösterreich' },
  'schwechat': { lat: 48.1381, lng: 16.4708, bezirk: 'Bruck an der Leitha', bundesland: 'Niederösterreich' },
  'stockerau': { lat: 48.3833, lng: 16.2108, bezirk: 'Korneuburg', bundesland: 'Niederösterreich' },
  'ternitz': { lat: 47.7167, lng: 16.0333, bezirk: 'Neunkirchen', bundesland: 'Niederösterreich' },
  'klosterneuburg': { lat: 48.3053, lng: 16.3256, bezirk: 'Tulln', bundesland: 'Niederösterreich' },
  'traiskirchen': { lat: 48.0153, lng: 16.2933, bezirk: 'Baden', bundesland: 'Niederösterreich' },
  'perchtoldsdorf': { lat: 48.1192, lng: 16.2669, bezirk: 'Mödling', bundesland: 'Niederösterreich' },
  'brunn-am-gebirge': { lat: 48.1083, lng: 16.2897, bezirk: 'Mödling', bundesland: 'Niederösterreich' },
  'voesendorf': { lat: 48.1267, lng: 16.3308, bezirk: 'Mödling', bundesland: 'Niederösterreich' },
  'deutsch-wagram': { lat: 48.3100, lng: 16.5650, bezirk: 'Gänserndorf', bundesland: 'Niederösterreich' },
  'gerasdorf': { lat: 48.2936, lng: 16.4669, bezirk: 'Korneuburg', bundesland: 'Niederösterreich' },
  'wolkersdorf': { lat: 48.3875, lng: 16.5183, bezirk: 'Mistelbach', bundesland: 'Niederösterreich' },
  'gmuend': { lat: 48.7683, lng: 14.9833, bezirk: 'Gmünd', bundesland: 'Niederösterreich' },
  'bad-voeslau': { lat: 47.9667, lng: 16.2167, bezirk: 'Baden', bundesland: 'Niederösterreich' },
  'ebreichsdorf': { lat: 47.9603, lng: 16.3939, bezirk: 'Baden', bundesland: 'Niederösterreich' },
  'guntramsdorf': { lat: 48.0472, lng: 16.3103, bezirk: 'Mödling', bundesland: 'Niederösterreich' },
  'purkersdorf': { lat: 48.2086, lng: 16.1750, bezirk: 'Sankt Pölten-Land', bundesland: 'Niederösterreich' },
  'himberg': { lat: 48.0833, lng: 16.4333, bezirk: 'Bruck an der Leitha', bundesland: 'Niederösterreich' },
  'langenzersdorf': { lat: 48.3011, lng: 16.3583, bezirk: 'Korneuburg', bundesland: 'Niederösterreich' },

  // ── Oberösterreich ────────────────────────────────────────────────────────
  'linz': { lat: 48.3064, lng: 14.2861, bezirk: 'Linz', bundesland: 'Oberösterreich' },
  'wels': { lat: 48.1575, lng: 14.0289, bezirk: 'Wels', bundesland: 'Oberösterreich' },
  'steyr': { lat: 48.0381, lng: 14.4214, bezirk: 'Steyr', bundesland: 'Oberösterreich' },
  'leonding': { lat: 48.2800, lng: 14.2500, bezirk: 'Linz-Land', bundesland: 'Oberösterreich' },
  'traun': { lat: 48.2228, lng: 14.2381, bezirk: 'Linz-Land', bundesland: 'Oberösterreich' },
  'braunau-am-inn': { lat: 48.2563, lng: 13.0434, bezirk: 'Braunau am Inn', bundesland: 'Oberösterreich' },
  'ansfelden': { lat: 48.2097, lng: 14.2878, bezirk: 'Linz-Land', bundesland: 'Oberösterreich' },
  'enns': { lat: 48.2125, lng: 14.4750, bezirk: 'Linz-Land', bundesland: 'Oberösterreich' },
  'gmunden': { lat: 47.9186, lng: 13.8003, bezirk: 'Gmunden', bundesland: 'Oberösterreich' },
  'voecklabruck': { lat: 48.0033, lng: 13.6561, bezirk: 'Vöcklabruck', bundesland: 'Oberösterreich' },
  'ried-im-innkreis': { lat: 48.2100, lng: 13.4893, bezirk: 'Ried im Innkreis', bundesland: 'Oberösterreich' },
  'bad-ischl': { lat: 47.7108, lng: 13.6272, bezirk: 'Gmunden', bundesland: 'Oberösterreich' },
  'marchtrenk': { lat: 48.1919, lng: 14.1139, bezirk: 'Wels-Land', bundesland: 'Oberösterreich' },
  'voecklamarkt': { lat: 48.0000, lng: 13.4833, bezirk: 'Vöcklabruck', bundesland: 'Oberösterreich' },
  'attnang-puchheim': { lat: 48.0128, lng: 13.7181, bezirk: 'Vöcklabruck', bundesland: 'Oberösterreich' },
  'freistadt': { lat: 48.5117, lng: 14.5050, bezirk: 'Freistadt', bundesland: 'Oberösterreich' },
  'perg': { lat: 48.2450, lng: 14.6361, bezirk: 'Perg', bundesland: 'Oberösterreich' },
  'rohrbach-berg': { lat: 48.5724, lng: 13.9892, bezirk: 'Rohrbach', bundesland: 'Oberösterreich' },
  'eferding': { lat: 48.3089, lng: 13.9753, bezirk: 'Eferding', bundesland: 'Oberösterreich' },
  'grieskirchen': { lat: 48.2333, lng: 13.8333, bezirk: 'Grieskirchen', bundesland: 'Oberösterreich' },
  'kirchdorf-an-der-krems': { lat: 47.9063, lng: 14.1198, bezirk: 'Kirchdorf an der Krems', bundesland: 'Oberösterreich' },
  'schaerding': { lat: 48.4580, lng: 13.4316, bezirk: 'Schärding', bundesland: 'Oberösterreich' },
  'bad-hall': { lat: 48.0378, lng: 14.2103, bezirk: 'Steyr-Land', bundesland: 'Oberösterreich' },
  'thalheim-bei-wels': { lat: 48.1500, lng: 14.0333, bezirk: 'Wels-Land', bundesland: 'Oberösterreich' },
  'pasching': { lat: 48.2592, lng: 14.2072, bezirk: 'Linz-Land', bundesland: 'Oberösterreich' },
  'asten': { lat: 48.2231, lng: 14.4136, bezirk: 'Linz-Land', bundesland: 'Oberösterreich' },

  // ── Salzburg ──────────────────────────────────────────────────────────────
  'salzburg-stadt': { lat: 47.7994, lng: 13.0440, bezirk: 'Salzburg', bundesland: 'Salzburg' },
  'hallein': { lat: 47.6825, lng: 13.1004, bezirk: 'Hallein', bundesland: 'Salzburg' },
  'wals-siezenheim': { lat: 47.7900, lng: 13.0100, bezirk: 'Salzburg-Umgebung', bundesland: 'Salzburg' },
  'seekirchen': { lat: 47.9000, lng: 13.1333, bezirk: 'Salzburg-Umgebung', bundesland: 'Salzburg' },
  'st-johann-im-pongau': { lat: 47.3476, lng: 13.2150, bezirk: 'Sankt Johann im Pongau', bundesland: 'Salzburg' },
  'zell-am-see': { lat: 47.3235, lng: 12.7969, bezirk: 'Zell am See', bundesland: 'Salzburg' },
  'bischofshofen': { lat: 47.4167, lng: 13.2167, bezirk: 'Sankt Johann im Pongau', bundesland: 'Salzburg' },
  'saalfelden': { lat: 47.4264, lng: 12.8483, bezirk: 'Zell am See', bundesland: 'Salzburg' },
  'tamsweg': { lat: 47.1296, lng: 13.8104, bezirk: 'Tamsweg', bundesland: 'Salzburg' },
  'neumarkt-am-wallersee': { lat: 47.9500, lng: 13.2167, bezirk: 'Salzburg-Umgebung', bundesland: 'Salzburg' },
  'oberndorf': { lat: 47.9500, lng: 12.9333, bezirk: 'Salzburg-Umgebung', bundesland: 'Salzburg' },
  'mittersill': { lat: 47.2833, lng: 12.4833, bezirk: 'Zell am See', bundesland: 'Salzburg' },
  'radstadt': { lat: 47.3833, lng: 13.4667, bezirk: 'Sankt Johann im Pongau', bundesland: 'Salzburg' },

  // ── Steiermark ────────────────────────────────────────────────────────────
  'graz': { lat: 47.0707, lng: 15.4395, bezirk: 'Graz', bundesland: 'Steiermark' },
  'leoben': { lat: 47.3765, lng: 15.0914, bezirk: 'Leoben', bundesland: 'Steiermark' },
  'kapfenberg': { lat: 47.4444, lng: 15.2947, bezirk: 'Bruck-Mürzzuschlag', bundesland: 'Steiermark' },
  'bruck-an-der-mur': { lat: 47.4099, lng: 15.2686, bezirk: 'Bruck-Mürzzuschlag', bundesland: 'Steiermark' },
  'leibnitz': { lat: 46.7816, lng: 15.5384, bezirk: 'Leibnitz', bundesland: 'Steiermark' },
  'knittelfeld': { lat: 47.2167, lng: 14.8167, bezirk: 'Murtal', bundesland: 'Steiermark' },
  'koflach': { lat: 47.0667, lng: 15.0833, bezirk: 'Voitsberg', bundesland: 'Steiermark' },
  'weiz': { lat: 47.2167, lng: 15.6222, bezirk: 'Weiz', bundesland: 'Steiermark' },
  'deutschlandsberg': { lat: 46.8146, lng: 15.2138, bezirk: 'Deutschlandsberg', bundesland: 'Steiermark' },
  'hartberg': { lat: 47.2815, lng: 15.9730, bezirk: 'Hartberg-Fürstenfeld', bundesland: 'Steiermark' },
  'liezen': { lat: 47.5674, lng: 14.2432, bezirk: 'Liezen', bundesland: 'Steiermark' },
  'voitsberg': { lat: 47.0505, lng: 15.1475, bezirk: 'Voitsberg', bundesland: 'Steiermark' },
  'murau': { lat: 47.1130, lng: 14.1690, bezirk: 'Murau', bundesland: 'Steiermark' },
  'muerzzuschlag': { lat: 47.6078, lng: 15.6753, bezirk: 'Bruck-Mürzzuschlag', bundesland: 'Steiermark' },
  'judenburg': { lat: 47.1697, lng: 14.6625, bezirk: 'Murtal', bundesland: 'Steiermark' },
  'fuerstenfeld': { lat: 47.0528, lng: 16.0833, bezirk: 'Hartberg-Fürstenfeld', bundesland: 'Steiermark' },
  'feldbach': { lat: 46.9531, lng: 15.8886, bezirk: 'Südoststeiermark', bundesland: 'Steiermark' },
  'gleisdorf': { lat: 47.1000, lng: 15.7000, bezirk: 'Weiz', bundesland: 'Steiermark' },
  'bad-radkersburg': { lat: 46.6872, lng: 15.9872, bezirk: 'Südoststeiermark', bundesland: 'Steiermark' },
  'trofaiach': { lat: 47.4292, lng: 15.0086, bezirk: 'Leoben', bundesland: 'Steiermark' },
  'kindberg': { lat: 47.5069, lng: 15.4522, bezirk: 'Bruck-Mürzzuschlag', bundesland: 'Steiermark' },
  'gratkorn': { lat: 47.1333, lng: 15.3667, bezirk: 'Graz-Umgebung', bundesland: 'Steiermark' },
  'seiersberg-pirka': { lat: 47.0139, lng: 15.4039, bezirk: 'Graz-Umgebung', bundesland: 'Steiermark' },
  'gratwein-strassengel': { lat: 47.1333, lng: 15.3167, bezirk: 'Graz-Umgebung', bundesland: 'Steiermark' },

  // ── Tirol ─────────────────────────────────────────────────────────────────
  'innsbruck': { lat: 47.2627, lng: 11.3946, bezirk: 'Innsbruck', bundesland: 'Tirol' },
  'kufstein': { lat: 47.5833, lng: 12.1667, bezirk: 'Kufstein', bundesland: 'Tirol' },
  'telfs': { lat: 47.3069, lng: 11.0711, bezirk: 'Innsbruck-Land', bundesland: 'Tirol' },
  'hall-in-tirol': { lat: 47.2867, lng: 11.5083, bezirk: 'Innsbruck-Land', bundesland: 'Tirol' },
  'schwaz': { lat: 47.3519, lng: 11.7100, bezirk: 'Schwaz', bundesland: 'Tirol' },
  'woergl': { lat: 47.4892, lng: 12.0667, bezirk: 'Kufstein', bundesland: 'Tirol' },
  'imst': { lat: 47.2450, lng: 10.7397, bezirk: 'Imst', bundesland: 'Tirol' },
  'lienz': { lat: 46.8289, lng: 12.7690, bezirk: 'Lienz', bundesland: 'Tirol' },
  'rum': { lat: 47.2833, lng: 11.4567, bezirk: 'Innsbruck-Land', bundesland: 'Tirol' },
  'landeck': { lat: 47.1397, lng: 10.5678, bezirk: 'Landeck', bundesland: 'Tirol' },
  'reutte': { lat: 47.4854, lng: 10.7181, bezirk: 'Reutte', bundesland: 'Tirol' },
  'kitzbuehel': { lat: 47.4464, lng: 12.3922, bezirk: 'Kitzbühel', bundesland: 'Tirol' },
  'st-johann-in-tirol': { lat: 47.5200, lng: 12.4253, bezirk: 'Kitzbühel', bundesland: 'Tirol' },
  'voels': { lat: 47.2586, lng: 11.2219, bezirk: 'Innsbruck-Land', bundesland: 'Tirol' },
  'absam': { lat: 47.2981, lng: 11.5197, bezirk: 'Innsbruck-Land', bundesland: 'Tirol' },
  'zirl': { lat: 47.2733, lng: 11.2394, bezirk: 'Innsbruck-Land', bundesland: 'Tirol' },
  'jenbach': { lat: 47.3939, lng: 11.7731, bezirk: 'Schwaz', bundesland: 'Tirol' },

  // ── Vorarlberg ────────────────────────────────────────────────────────────
  'bregenz': { lat: 47.5031, lng: 9.7471, bezirk: 'Bregenz', bundesland: 'Vorarlberg' },
  'dornbirn': { lat: 47.4143, lng: 9.7420, bezirk: 'Dornbirn', bundesland: 'Vorarlberg' },
  'feldkirch': { lat: 47.2378, lng: 9.5981, bezirk: 'Feldkirch', bundesland: 'Vorarlberg' },
  'bludenz': { lat: 47.1549, lng: 9.8224, bezirk: 'Bludenz', bundesland: 'Vorarlberg' },
  'lustenau': { lat: 47.4264, lng: 9.6611, bezirk: 'Dornbirn', bundesland: 'Vorarlberg' },
  'hohenems': { lat: 47.3614, lng: 9.6856, bezirk: 'Dornbirn', bundesland: 'Vorarlberg' },
  'hard': { lat: 47.4833, lng: 9.6833, bezirk: 'Bregenz', bundesland: 'Vorarlberg' },
  'goetzis': { lat: 47.3333, lng: 9.6333, bezirk: 'Feldkirch', bundesland: 'Vorarlberg' },
  'rankweil': { lat: 47.2667, lng: 9.6417, bezirk: 'Feldkirch', bundesland: 'Vorarlberg' },
  'lauterach': { lat: 47.4753, lng: 9.7292, bezirk: 'Bregenz', bundesland: 'Vorarlberg' },
  'wolfurt': { lat: 47.4622, lng: 9.7461, bezirk: 'Bregenz', bundesland: 'Vorarlberg' },
  'schwarzach': { lat: 47.4333, lng: 9.7500, bezirk: 'Bregenz', bundesland: 'Vorarlberg' },
};

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Look up Bezirk (district) info from a URL slug.
 * Returns undefined if not found.
 */
export function getBezirkFromSlug(slug: string): (BezirkInfo & { slug: string }) | undefined {
  const normalised = slug.toLowerCase().trim();
  const info = BEZIRK_COORDINATES[normalised];
  if (info) {
    return { ...info, slug: normalised };
  }
  return undefined;
}

/**
 * Look up Gemeinde (municipality) info from a URL slug.
 * Returns undefined if not found.
 */
export function getGemeindeFromSlug(slug: string): (GemeindeInfo & { slug: string }) | undefined {
  const normalised = slug.toLowerCase().trim();
  const info = GEMEINDE_COORDINATES[normalised];
  if (info) {
    return { ...info, slug: normalised };
  }
  return undefined;
}

/**
 * Find coordinates for a given slug by searching first in Bezirke, then in Gemeinden.
 * Returns an object with lat, lng and source ('bezirk' | 'gemeinde') or undefined.
 */
export function findLocationCoords(
  slug: string
): { lat: number; lng: number; source: 'bezirk' | 'gemeinde'; bundesland: string } | undefined {
  const normalised = slug.toLowerCase().trim();

  const bezirk = BEZIRK_COORDINATES[normalised];
  if (bezirk) {
    return { lat: bezirk.lat, lng: bezirk.lng, source: 'bezirk', bundesland: bezirk.bundesland };
  }

  const gemeinde = GEMEINDE_COORDINATES[normalised];
  if (gemeinde) {
    return { lat: gemeinde.lat, lng: gemeinde.lng, source: 'gemeinde', bundesland: gemeinde.bundesland };
  }

  return undefined;
}
