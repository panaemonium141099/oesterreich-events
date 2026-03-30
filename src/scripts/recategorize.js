const db = require('better-sqlite3')('./data/events.db');

const FERATEL_TAG_MAP = {
  'Musik': 'Musik', 'Sport': 'Sport', 'Kultur': 'Kultur',
  'Kulinarium': 'Wein & Kulinarik',
  'Kinder- & Familienveranstaltungen': 'Familie',
  'Bühne & Festival': 'Kultur',
  'Brauchtum & Feste': 'Feste & Brauchtum',
  'Tradition & Brauchtum': 'Feste & Brauchtum',
  'Ausstellungen': 'Kultur', 'Bauernherbst': 'Feste & Brauchtum',
  'Unterhaltung & Tanzmusik': 'Musik', 'Advent': 'Feste & Brauchtum',
  'Almsommer': 'Natur', 'Nationalpark Exkursion': 'Natur',
  'AKTIV': 'Sport', 'Aktivität / Erlebnis': 'Sport',
};

const KW = {
  'Nightlife': ['rave','techno','tech house','psytrance','goa','hardstyle','dubstep','afterhour','clubbing','dj set','dj-set','party ','partynacht','disco','karaoke','pub quiz','hangover party','dance night','tanzabend','trance','drum and bass','dnb','minimal techno','sunday dance'],
  'Religion': ['gottesdienst','festmesse','hochamt','heilige messe','hl. messe','sonntagsmesse','vesper','andacht','anbetung','rosenkranz','wallfahrt','fußwallfahrt','buswallfahrt','pilger','prozession','fronleichnam','palmsonntag','palmweihe','kreuzweg','karfreitag','osternacht','auferstehungsfeier','firmung','erstkommunion','taufe','orgelkonzert','rorate','seelsorge','bibelrunde','herz-jesu','florianimesse','hubertusmesse','speisensegnung','kirchenmusik','gebet','abendmahl','emmausgang','gründonnerstag'],
  'Gesundheit': ['gesundheit','sprechtag','sprechstunde','elternberatung','sozialberatung','blutspende','blutspendeaktion','trauergruppe','selbsthilfe','therapie','wellness','therme','meditation','achtsamkeit','gesundheitsvortrag','impfung','pflegende angehörige','pflegenahversorgung','demenztraining','gedächtnistraining','wirbelsäule','rückenaktiv'],
  'Natur': ['natur','nationalpark','naturführung','vogelbeobachtung','ornitholog','tierpark','zoo','wildpark','botanik','naturpark','almsommer','almwanderung','pilze','kräuter','wildkräuter','heilkräuter','flurreinigung','umwelt','klimaschutz','imker','bienen','garten','schaugarten','sternwarte','mischkultur','permakultur'],
  'Familie': ['kinder','kids','familie','family','kindertheater','puppentheater','kinderfest','familientag','kinderführung','ostereiersuche','feriencamp','ferienprogramm','ferienspiel','ferienwoche','spielnachmittag','basteln','jugendzentrum','zwergerltreff','eltern-kind','mutter-kind','kasperl','kinderturnen','kinderdisco','kinderkoch','kinderback','babyschwimm'],
  'Feste & Brauchtum': ['dorffest','ortsfest','volksfest','stadtfest','straßenfest','feuerwehrfest','vereinsfest','heurigenfest','kirtag','kirchtag','kirchweih','pfarrfest','pfarrcafe','maibaum','maibaumfest','sonnwendfeier','sonnwendfest','erntedankfest','erntedank','almabtrieb','almfest','fasching','karneval','grillfest','grillabend','sommerfest','frühlingsfest','herbstfest','osterfeuer','osterfest','frühschoppen','dämmerschoppen','brauchtum','tradition','schützenfest','jubiläum','silvester','punschstand','adventfeier','adventzauber','nikolausfeier','ball ','stammtisch','seniorentreffen','seniorennachmittag','bauernherbst','hüttengaudi','fest des jahres','feuerwehrheuriger','feuerlöscherüberprüfung'],
  'Märkte': ['markt','ostermarkt','weihnachtsmarkt','adventmarkt','flohmarkt','bauernmarkt','christkindlmarkt','trödelmarkt','wochenmarkt','genussmarkt','kunsthandwerk','samentausch','pflanzenmarkt','pflanzentausch','kellergasse','messe ','fachmesse','nachtflohmarkt'],
  'Wein & Kulinarik': ['weinverkostung','weinfest','weinwanderung','winzer','weingut','weinfrühling','weinherbst','buschenschank','kulinarik','verkostung','tasting','degustation','genuss','kochen','kochkurs','gastronomie','slow food','gourmet','bier ','bierfest','brauerei','schnaps','destillerie','steak','bbq','grillkurs','käseverkostung','brunch','mittagstisch','hofführung'],
  'Sport': ['sport','lauf ','laufen','marathon','radtour','radeln','radausfahrt','radwandertag','bike','biking','cycling','mountainbike','e-bike','running','parkrun','stadtlauf','wanderung','wandern','bergwanderung','schneeschuhwanderung','fußball','fussball','tennis','schwimmen','triathlon','yoga','fitness','gymnastik','turnen','pilates','qigong','golf','reiten','segeln','surfen','klettern','bouldern','skifahren','ski ','skitour','snowboard','eislaufen','langlauf','volleyball','basketball','handball','motorsport','draisine','kuppelcup','sportfest','schießen','preisschnapsen','kegeln','krafttraining','workout','zumba','paddeln','rudern','rafting','canyoning','paragleit','lauftreff','sportverein'],
  'Bildung': ['vortrag','seminar','workshop','kurs ','fortbildung','weiterbildung','schulung','malkurs','erste hilfe','erste-hilfe','informationsveranstaltung','infoabend','podiumsdiskussion','repair café','repair cafe','nähkurs','handarbeit','flechtenseminar','töpferkurs'],
  'Kultur': ['theater','theaterstück','ausstellung','exhibition','museum','galerie','kunst','lesung','literatur','buchpräsentation','kabarett','comedy','stand-up','kino','film ','filmabend','oper ','operette','ballett','musical','vernissage','performance','installation','fotografie','zirkus','varieté','komödie','satire','kultur','slam','poetry','magic','zauberer','burgführung','schlossführung','stadtführung','museumsführung','besichtigung','rundgang','krimi','mörderdinner','architektur','denkmal'],
  'Musik': ['konzert','concert','musik','music','jazz','klassik','chor','chorkonzert','orchester','festival','musikfestival','band ','liveband','livemusik','live-musik','rock','pop','symphonie','kammermusik','blasmusik','blasorchester','musikkapelle','trachtenkapelle','serenade','matinee','open air','schlager','volksmusik','kirchenkonzert','benefizkonzert','sommernachtskonzert','brass','big band','swing','blues','funk','soul','tribute','unplugged','acoustic','heavy metal','metal','indie','hiphop','hip hop','rap','philharmon','reggae','country','folk','singer-songwriter','frühlingskonzert','herbstkonzert','weihnachtskonzert','sommerkonzert','platzkonzert','promenadenkonzert','adventkonzert','abschlusskonzert','sounds','sänger','sängerin'],
};

const PRIORITY = ['Nightlife','Religion','Gesundheit','Natur','Familie','Feste & Brauchtum','Märkte','Wein & Kulinarik','Sport','Bildung','Kultur','Musik'];

function categorize(title, desc, tags) {
  const t = (title||'').toLowerCase();
  const d = (desc||'').toLowerCase();
  for (const tag of tags) { if (FERATEL_TAG_MAP[tag]) return FERATEL_TAG_MAP[tag]; }
  for (const cat of PRIORITY) { if (KW[cat].some(kw => t.includes(kw))) return cat; }
  const tagText = tags.join(' ').toLowerCase();
  for (const cat of PRIORITY) { if (KW[cat].some(kw => tagText.includes(kw))) return cat; }
  for (const cat of PRIORITY) { if (KW[cat].some(kw => d.includes(kw))) return cat; }
  return 'Sonstiges';
}

const events = db.prepare('SELECT id, title, description, tags, category FROM events').all();
const update = db.prepare('UPDATE events SET category = ? WHERE id = ?');
const stats = {};
let changed = 0;

db.transaction(() => {
  for (const e of events) {
    let tags = [];
    try { tags = JSON.parse(e.tags || '[]'); } catch {}
    if (!Array.isArray(tags)) tags = [];
    const cat = categorize(e.title, e.description, tags);
    stats[cat] = (stats[cat] || 0) + 1;
    if (cat !== e.category) { update.run(cat, e.id); changed++; }
  }
})();

console.log('Changed:', changed);
console.log('\nNew distribution:');
const total = events.length;
Object.entries(stats).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
  console.log('  ' + k + ': ' + v + ' (' + Math.round(v/total*100) + '%)'));
console.log('Total:', total);
