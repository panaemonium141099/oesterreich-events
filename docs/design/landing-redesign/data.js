// Echte Inhalte von lasstreffen.at am 29.10.2026 (Landing, /entdecken, festivals-upcoming.json,
// Blog-Posts). Preise nur dort, wo /entdecken sie anzeigte. Freizeit-Kacheln ohne Bild (API liefert
// die Deskline-URLs nur gekürzt), deshalb der Kategorie-Verlauf wie auf der echten Seite.
const OE = 'https://www.oeticket.com/obj/media/AT-eventim/teaser/222x222/';
const LT = 'https://lasstreffen.at';
const WT = 'https://media.wien-ticket.at/';
const prox = (u, w = 640) => `${LT}/_next/image?url=${encodeURIComponent(u)}&w=${w}&q=75`;

window.TODAY = { weekday: 'Donnerstag', date: '29. Oktober', count: '88.210' };

window.SEASON = {
  kicker: 'Halloween',
  title: 'Grusel, Kürbis & Weinfeste',
  weather: '12° am Samstag in Wien',
  more: 'Alle Halloween-Events',
  stage: prox('https://data.burgenland.info/asset/42aff345-62fe-498a-b610-4a533869b8b9/F56BF_9yixpQmPbS4WG_kl8GeyWfd_Eo7Eskyj9Hb5M/1788267212/default/martiniloben.jpg', 1920),
  stageCredit: 'Purbacher Martiniloben, Burgenland Tourismus',
};

window.SEASON_PICKS = [
  { t: 'Purbacher Martiniloben', img: prox('https://data.burgenland.info/asset/42aff345-62fe-498a-b610-4a533869b8b9/F56BF_9yixpQmPbS4WG_kl8GeyWfd_Eo7Eskyj9Hb5M/1788267212/default/martiniloben.jpg'), day: 'Fr 6. Nov.', time: '15:00', venue: 'Weingüter Purbach', city: 'Neusiedl am See', tip: true },
  { t: 'Conchita Wurst: Haunted Harmonies', img: WT + 'Rq6uosuNp3Ai8r3pBpYz6yShMwpfzXvlwIP3m3POLPg/rs:fill-down:1280:1280/f:webp/gravity:fp:0.43:0.385/plain/local:///27890_Haunted_Harmonies_2026_03.jpg', day: 'Sa 31. Okt.', time: '20:00', venue: 'Globe Wien', city: 'Wien' },
  { t: 'Halloween Party', img: prox('https://www.gde-elsbethen.at/system/web/GetImage.ashx?fileid=2134239&mode=T&width=640&height=480&cropping=CENTER&cts=1767958443'), day: 'Sa 31. Okt.', time: '', venue: 'Volksschule Elsbethen', city: 'Salzburg-Umgebung', price: 'Gratis' },
  { t: 'Tal des Unheils', img: OE + '2026/Tal_des_Unheils_TICKETS_2026_c_Verein_zur_Erhaltung_der_Dorfgemeinschaft_222.jpg', day: 'Sa 31. Okt.', time: '23:30', venue: 'Gutshof Thürnthal', city: 'Tulln' },
  { t: 'Dracula: A Comedy of Terrors', img: OE + '2026/Dracula-A-Comedy-of-Terrors-2026-tickets-c-stAgeclimbers-m.jpg', day: 'Do 29. Okt.', time: '19:30', venue: 'Altes Theater Steyr', city: 'Steyr' },
  { t: 'Weinbauernabend im Gartenhotel Ochsenberger', img: prox('https://resc.deskline.net/images/AT1/1/3b179096-27ba-4129-ba26-e2faa19b1f72/10/Garten-Hotel_Ochensberger_Weine_Oststeiermark.jpg'), day: 'Fr 30. Okt.', time: '20:00', venue: 'St. Ruprecht an der Raab', city: 'Weiz' },
  { t: '2. Junker & Bier Verkostung', img: prox('https://resc.deskline.net/images/AT1/1/e2d1f339-93d8-4e34-8598-a0adf3df903c/10/Weintrauben_I_Ges%c3%a4use_I_Steiermark.jpg'), day: 'Fr 6. Nov.', time: '18:00', venue: 'Gebetsroither', city: 'Liezen' },
];

window.PICKS = [
  { t: 'ERSTE BANK OPEN 2026', img: WT + 'NXNlVhbhgPIZeN5wWpp_XIsIqYdceNTVHdMY-jzBSuo/rs:fill-down:1280:1280/f:webp/gravity:fp:0.5:0.5/plain/local:///27354_EBO26_STH_WT_Header1080x1080.png', day: 'Heute', time: '13:30', venue: 'Wiener Stadthalle', city: 'Wien', price: 'ab 29 €', tag: 'Top-Pick heute' },
  { t: 'Conchita Wurst: Haunted Harmonies', img: WT + 'Rq6uosuNp3Ai8r3pBpYz6yShMwpfzXvlwIP3m3POLPg/rs:fill-down:1280:1280/f:webp/gravity:fp:0.43:0.385/plain/local:///27890_Haunted_Harmonies_2026_03.jpg', day: 'Sa', time: '20:00', venue: 'Globe Wien', city: 'Wien' },
  { t: "Fiddler's Green", img: OE + '2026/fiddlers-green_c-franz-schepers_tickets-2026-m.jpg', day: 'Morgen', time: '20:00', venue: 'ppc', city: 'Graz', price: '48,50 €' },
  { t: 'Dardan', img: OE + '2026/Dardan-Dilemma-Tour-2026-tickets-m-0810.jpg', day: 'Heute', time: '20:00', venue: 'Gasometer', city: 'Wien' },
  { t: 'Was ihr wollt', img: OE + '2026/Was_ihr_wollt_Schauspielhaus_Salzburg_tickets_2026_c_Schauspielhaus_Salzburg_222.jpg', day: 'Heute', time: '19:30', venue: 'Schauspielhaus', city: 'Salzburg', price: '39,30 €' },
];

window.TONIGHT = [
  { t: 'Dardan', img: OE + '2026/Dardan-Dilemma-Tour-2026-tickets-m-0810.jpg', day: 'Do 29. Okt.', time: '20:00', venue: 'Raiffeisen Halle Gasometer', city: 'Wien' },
  { t: 'Stand-up Comedy Mixed Show', img: OE + '2026/Stand_up_Comedy_Mixed_Show_tickets_2026_c_lucky_222.jpg', day: 'Do 29. Okt.', time: '20:00', venue: 'Lucky Punch Comedy Club', city: 'Wien' },
  { t: 'Poxrucker Sisters: DNA Tour', img: OE + '2025/Poxrucker-Sisters-DNA-2026-tickets-c-Laura-Edl-m.jpg', day: 'Do 29. Okt.', time: '19:30', venue: 'Kongress & TheaterHaus', city: 'Bad Ischl' },
  { t: 'Chopin & Viennese Friends', img: OE + '2026/Chopin-Viennese-Friends-2026-tickets-m.jpg', day: 'Do 29. Okt.', time: '17:00', venue: 'Royal Vienna Hall', city: 'Wien' },
  { t: 'Justina Lee Brown: Echoes of Home', img: OE + '2026/Justina_Lee_Brown_c_JLB_Music_222.jpg', day: 'Do 29. Okt.', time: '20:00', venue: 'Altes Kino Rankweil', city: 'Feldkirch' },
  { t: 'Florian Scheuba: Schönen guten Abend', img: OE + '2025/Florian_Scheuba_tickets_2025_c_marija_kanizaj_m.jpg', day: 'Do 29. Okt.', time: '20:00', venue: 'Kulisse', city: 'Wien' },
  { t: 'Imperial Gala Concert', img: OE + '2026/Imperial_Gala_Concert_tickets_2026_c_Tritsch_Tratsch_Veranstaltungs_GmbH_222.jpg', day: 'Do 29. Okt.', time: '20:00', venue: 'Palais Auersperg', city: 'Wien' },
  { t: 'Così fan tutte: Premiere', img: OE + '2026/COSI_FAN_TUTTE_tickets_2026_c_Verena_Schellander_Stadttheater_Klagenfurt_222.jpg', day: 'Do 29. Okt.', time: '19:30', venue: 'Stadttheater', city: 'Klagenfurt' },
  { t: 'Dan Knopper: Salon Klaus', img: OE + '2025/Dan-Knopper-Salon-Klaus-2026-tickets-m.jpg', day: 'Do 29. Okt.', time: '19:30', venue: 'kleines theater', city: 'Salzburg' },
  { t: 'David Scheid: The Kabarettist', img: OE + '2025/David-Scheid-The-Kabarettist-2025-tickets-c-Antonia-Mayer-m.jpg', day: 'Do 29. Okt.', time: '20:00', venue: 'Alter Schlachthof', city: 'Wels' },
];

window.WEEKEND = [
  { t: "Fiddler's Green", img: OE + '2026/fiddlers-green_c-franz-schepers_tickets-2026-m.jpg', day: 'Fr 30. Okt.', time: '20:00', venue: 'ppc', city: 'Graz', price: '48,50 €' },
  { t: 'Sego (US) im Club Lucia', img: OE + '2026/ContentMarei/Sego_US_im_Club_Lucia_c_Sydney_Winn_222.jpg', day: 'Sa 31. Okt.', time: '20:00', venue: 'Club Lucia', city: 'Wien', price: '24,50 €' },
  { t: 'Don Giovanni: Kinderoper zum Mitmachen', img: OE + '2024/Don_Giovanni_-_KinderOPER_zum_Mitmachen_222.jpg', day: 'Sa 31. Okt.', time: '14:30', venue: 'Peterskirche', city: 'Wien', price: '26,50 €' },
  { t: 'Gisele Jackson + Club 54: Soul of Disco', img: WT + 'crdH_8ka1vYT6BMsm2jP3GO2nkN-6g8bMZAz_-QWLN0/rs:fill-down:1280:1280/f:webp/gravity:fp:0.5:0.5/plain/local:///28107_Gisele_Jackson___Club54_-_Soul_of_Disco_1280_x_500__1_.png', day: 'Sa 31. Okt.', time: '19:45', venue: 'CasaNova', city: 'Wien' },
  { t: 'Nachtschicht Revival XXL: Groove Coverage', img: OE + '2026/Nachtschicht_Revival_XXL_Groove_Coverage_tickets_2026_c_Reinisch_222.jpg', day: 'Sa 31. Okt.', time: '20:30', venue: 'Schwarzlsee', city: 'Graz-Umgebung' },
  { t: 'Tiavo: Hotel Tiavo Tour', img: OE + '2025/Tiavo-Hotel-Tiavo-Tour-2026-tickets-m.jpg', day: 'Sa 31. Okt.', time: '19:00', venue: 'Flex', city: 'Wien' },
  { t: 'Wiener Mozart Konzert', img: OE + '2025/Wiener_Mozart_Konzert_Musikverein_tickets_2025_c_Wiener_Mozart_Konzert_222.jpg', day: 'Sa 31. Okt.', time: '20:15', venue: 'Musikverein', city: 'Wien' },
  { t: 'The Umbilical Brothers: Speedmouse', img: OE + '2025/The-Umbilical-Brothers-2026-tickets-m.jpg', day: 'Sa 31. Okt.', time: '20:00', venue: 'Simm City', city: 'Wien' },
  { t: 'Stephan Zinner: Der Teufel, das Mädchen, der Blues und ich', img: OE + '2025/Stephan-Zinner-Der-Teufel-das-Maedchen-der-Blues-und-ich-2025-tickets-c-Alessandra-Schellnegger-m.jpg', day: 'Sa 31. Okt.', time: '19:30', venue: 'Stadtsaal', city: 'Wien' },
  { t: '(Alles) Was der Fall ist', img: OE + '2026/Alles_Was_der_Fall_ist_tickets_2026_Ayomide_Isaac_222.jpg', day: 'Sa 31. Okt.', time: '20:00', venue: 'neuebuehnevillach', city: 'Villach' },
  { t: 'DINOLAND', img: OE + '2026/dinoland-freilich-erlebnis-museum-tickets-2026-m.jpg', day: 'So 1. Nov.', time: '10:00', venue: 'Schloss Katzenberg', city: 'Ried im Innkreis' },
];

window.REGIONS = [
  ['wien', 'Wien'], ['niederoesterreich', 'Niederösterreich'], ['steiermark', 'Steiermark'], ['oberoesterreich', 'Oberösterreich'],
  ['salzburg', 'Salzburg'], ['tirol', 'Tirol'], ['kaernten', 'Kärnten'], ['burgenland', 'Burgenland'], ['vorarlberg', 'Vorarlberg'],
].map(([id, n]) => ({ id, n, img: `${LT}/images/regions/${id}.jpg` }));

window.FESTIVALS = [
  { t: 'Wien Modern', img: 'https://www.wienmodern.at/images/gross/3091.jpg', when: 'Fr 30. Okt. bis 30. Nov.', city: 'Wien', lineup: 'Pia Palme, Olga Neuwirth, Liza Lim' },
  { t: 'Winterfest', img: 'https://www.winterfest.at/wp-content/uploads/2026/06/YOAH-640x640.jpg', when: '25. Nov. bis 6. Jän.', city: 'Salzburg', lineup: 'Cirquework, Zip Zap Circus' },
  { t: 'Tiroler Festspiele Erl', img: 'https://www.tiroler-festspiele.at/img/containers/assets/header/tfe_winter_hero.jpg/b9ba66012a50b75cd3fd9143672c7be4/tfe_winter_hero.jpg', when: '6. Dez. bis 6. Jän.', city: 'Erl', lineup: 'La traviata, Silvesterkonzert' },
  { t: 'Resonanzen', img: 'https://konzerthaus.at/media/thumbnails/pixxio/1347372649/wkh_website_2_3_Resonanzen.jpg.1920x800_q85_crop_upscale.webp', when: '16. bis 23. Jän.', city: 'Wien', lineup: 'Dunedin Consort, Graindelavoix' },
  { t: 'Mozartwoche', img: 'https://mozarteum.at/static/62056c2bc7b10915087f1975819e598b/2026-04-21_Mozarteum_Portrait_RolandoVillazon_165.jpg', when: '21. bis 31. Jän.', city: 'Salzburg', lineup: 'Wiener Philharmoniker, Igor Levit' },
  { t: 'classic.Esterhazy', img: 'https://www-cdn.esterhazy.at/user/images//classic.Esterhazy/Konzertreihe-classic.Esterhazy_cAndreas-Tischler.jpg', when: 'ab 17. Jän.', city: 'Eisenstadt', lineup: 'Wiener Philharmoniker, Riccardo Muti' },
];

// Aktivitäten: /api/activities?setting=indoor am 29.10.2026, Bilder aus poi_activities.images
const DL = 'https://resc.deskline.net/images/';
window.ACTIVITIES = [
  { t: 'kärnten.museum', city: 'Klagenfurt', cat: 'Museum', img: DL + 'KTN/1/0595906d-5a97-484a-be81-6130d4aec30b/10/k%c3%a4rntenmuseum.jpeg' },
  { t: 'Bibliothek & Museum Stift Admont', city: 'Admont', cat: 'Museum', img: DL + 'AT1/1/a5d35e6d-6e4b-421b-9251-611f13b595d1/10/Gotik_Museum_im_Benediktinerstift_Admont.jpg' },
  { t: 'Forstmuseum Silvanum', city: 'Landl', cat: 'Museum', img: DL + 'AT1/1/5641b4e9-9c4a-4e9b-8b5d-5b04fa70ca5c/10/Augmented_Reality_im_Forstmuseum_Silvanum.jpg' },
  { t: 'Kräftereich St. Jakob im Walde', city: 'St. Jakob im Walde', cat: 'Ausstellung', img: DL + 'AT1/1/252a4ea2-5250-49ce-975a-634e18e33f60/10/Besucher_im_Ausstellungsraum_Oststeiermark.jpg' },
  { t: 'Kitzmantelfabrik Vorchdorf', city: 'Vorchdorf', cat: 'Museum', img: DL + 'AT2/1/6c243706-0ab1-4ac2-b0fb-58a4b949dd34/10/KITZMANTELFABRIKcTVB_Traunsee-Almtal_34.jpg' },
  { t: 'Maultrommelmacher Molln', city: 'Molln', cat: 'Schaubetrieb', img: DL + 'PYH/1/725bfa3f-ff7e-4b31-a1bc-ec952d8fc9f9/10/Maultrommel_Wimmer_Bades.jpg' },
  { t: 'Stift Griffen', city: 'Griffen', cat: 'Museum', img: DL + 'KTN/1/4c9083ea-983b-46b9-bb0a-50af3f3de790/10/Stift_Griffen_Fassade.jpg' },
];

window.BLOG = [
  { t: 'Halloween 2026 in Österreich', img: LT + '/images/blog/halloween-oesterreich/hero.jpg', meta: 'Ratgeber · 10. Sep.' },
  { t: 'Winterfest 2026/27: Zirkus aus Japan und Südafrika im Volksgarten', img: LT + '/images/blog/winterfest-2026/hero.jpg', meta: 'Festival-Vorschau · 26. Okt.' },
  { t: 'Grazer Christkindlmarkt', img: LT + '/images/blog/grazer-christkindlmarkt/hero.jpg', meta: 'Advent' },
  { t: 'Innsbrucker Christkindlmarkt', img: LT + '/images/blog/innsbruck-christkindlmarkt/hero.jpg', meta: 'Advent' },
];

/* ─── Render-Bausteine (gleich für alle Varianten) ───────────────────── */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const place = (e) => [e.venue, e.city].filter(Boolean).join(' · ');

window.card = (e) => `
<a class="ev" href="#">
  <div class="ph"><img src="${e.img}" alt="" loading="lazy">
    <span class="tm">${esc(e.day)}${e.time ? ' · ' + e.time : ''}</span>
    ${e.price ? `<span class="pr${e.price === 'Gratis' ? ' free' : ''}">${esc(e.price)}</span>` : ''}
  </div>
  <h3>${esc(e.t)}</h3><p>${esc(place(e))}</p>
</a>`;

window.pick = (e, big, tag) => `
<a class="pick${big ? ' big' : ''}" href="#">
  <img src="${e.img}" alt=""><div class="ov"></div>
  <div class="tx">${tag ? `<span class="tag${tag.sand ? ' sand' : ''}">${esc(tag.label)}</span>` : ''}
    <h3>${esc(e.t)}</h3>
    <p>${esc([`${e.day}${e.time ? ' ' + e.time : ''}`, place(e), e.price].filter(Boolean).join(' · '))}</p>
  </div>
</a>`;

window.shelf = (title, sub, all, inner) => `
<section class="shelf">
  <div class="hd"><h2>${esc(title)}</h2>${sub ? `<span>${esc(sub)}</span>` : ''}${all ? `<a href="#">${esc(all)}</a>` : ''}<div class="arr"><b>‹</b><b>›</b></div></div>
  <div class="track">${inner}</div>
</section>`;

window.regionTile = (r) => `<a class="rg" href="#"><img src="${r.img}" alt="" loading="lazy"><div class="ov"></div><b>${esc(r.n)}</b></a>`;

window.festCard = (f) => `
<a class="fest" href="#">
  <div class="ph"><img src="${f.img}" alt="" loading="lazy"><span class="tm">${esc(f.when)}</span></div>
  <h3>${esc(f.t)}</h3><p>${esc(f.city)}</p><p class="lu">${esc(f.lineup)}</p>
</a>`;

window.actCard = (a) => `
<a class="act" href="#">
  <div class="ph"><img src="${a.img}" alt="" loading="lazy"><span>${esc(a.cat)}</span></div>
  <h3>${esc(a.t)}</h3><p>${esc(a.city)}</p>
</a>`;

window.postCard = (p) => `
<a class="post" href="#">
  <div class="ph"><img src="${p.img}" alt="" loading="lazy"></div>
  <h3>${esc(p.t)}</h3><p>${esc(p.meta)}</p>
</a>`;

/** Der untere Teil der Landing, in allen drei Varianten identisch. */
window.renderBody = (opts = {}) => {
  const parts = [];
  if (opts.season) parts.push(shelf(`${SEASON.kicker}: ${SEASON.title}`, SEASON.weather, SEASON.more, SEASON_PICKS.map(card).join('')));
  parts.push(shelf('Heute Abend', `${TODAY.weekday}, ${TODAY.date}`, 'Alle anzeigen', TONIGHT.map(card).join('')));
  parts.push(shelf('Dieses Wochenende', 'Fr 30. Okt. bis So 1. Nov.', 'Alle anzeigen', WEEKEND.map(card).join('')));
  parts.push(shelf('Nach Region', '', '', REGIONS.map(regionTile).join('')));
  parts.push(shelf('Bei Regen', 'Ausflüge unter Dach, am Samstag 12° in Wien', 'Alle Freizeitaktivitäten', ACTIVITIES.map(actCard).join('')));
  parts.push(shelf('Festivals', 'kommende Ausgaben mit Programm', 'Alle Festivals', FESTIVALS.map(festCard).join('')));
  parts.push(shelf('Aus dem Blog', '', 'Alle Beiträge', BLOG.map(postCard).join('')));
  parts.push(`
<section class="rowline">
  <div><h2>Freitags die besten Events deiner Region</h2><p>Einmal pro Woche, ohne Konto, jederzeit abbestellbar.</p></div>
  <form onsubmit="return false"><input id="nl-mail" type="email" placeholder="deine@email.at"><select id="nl-region"><option>Ganz Österreich</option><option>Wien</option><option>Steiermark</option></select><button class="btn" type="submit">Anmelden</button></form>
</section>
<section class="rowline" style="border-top:0;margin-top:0">
  <div><h2>Mit Konto</h2><p>Kostenlos, mit Google oder E-Mail.</p></div>
  <div class="acc"><span><i>●</i>Künstlern folgen und Termine erfahren</span><span><i>●</i>Events merken</span><span><i>●</i>Erinnerung am Vortag</span><a class="ghostbtn" href="#">Anmelden</a></div>
</section>
<footer>
  <div class="fl"><a href="#">Über uns</a><a href="#">Blog</a><a href="#">Freizeit & Ausflüge</a><a href="#">Karte</a><a href="#">Event inserieren</a><a href="#">Für Firmen</a><a href="#">Impressum</a><a href="#">Datenschutz</a><a href="#">Datenquellen</a><a href="#">Kontakt</a></div>
  <p>Die Seite ist in Entwicklung. Fehler bitte an dev@glatzdev.com.</p>
  <p>© 2026 LassTreffen.at</p>
</footer>`);
  return parts.join('');
};

window.NAV = `
<div class="nav wrap"><span class="logo">lass<b>treffen</b>.at</span><div class="links"><span>Entdecken</span><span>Freizeit</span><span>Künstler</span><span>Karte</span><span>Meine Pläne</span></div><div class="search">⌕ Künstler, Event oder Ort</div><span class="cta">Anmelden</span></div>`;
window.TABBAR = `
<nav class="tabbar"><span class="on"><i></i>Entdecken</span><span><i></i>Freizeit</span><span><i></i>Künstler</span><span><i></i>Karte</span><span><i></i>Pläne</span></nav>`;
