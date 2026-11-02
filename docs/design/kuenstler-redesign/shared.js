// Gemeinsame Bausteine der drei Künstler-Varianten: Chrome (wie landing-redesign), Zustand
// Gast/Eingeloggt (per ?in in der URL), Folgen-Knopf, Künstlerblatt (Detail als Sheet).
window.SIGNED_IN = /[?#]in(&|$)/.test(location.search + location.hash);
window.TODAY_ISO = '2026-11-02';

window.NAV = `
<div class="nav wrap"><span class="logo">lass<b>treffen</b>.at</span><div class="links"><span>Entdecken</span><span>Freizeit</span><span class="on">Künstler</span><span>Karte</span><span>Meine Pläne</span></div><div class="search">⌕ Künstler, Event oder Ort</div><span class="cta">${window.SIGNED_IN ? 'Jona' : 'Anmelden'}</span></div>`;
window.TABBAR = `
<nav class="tabbar"><span><i></i>Entdecken</span><span><i></i>Freizeit</span><span class="on"><i></i>Künstler</span><span><i></i>Karte</span><span><i></i>Pläne</span></nav>`;

// Gefolgte Künstler des Beispielnutzers. Zwei davon (Bilderbuch, Wanda) haben gerade keinen
// Termin im Feed: so sieht man, wie die Seite den Fall zeigt.
window.FOLLOWED = ['alex-kristan', 'ernst-molden', 'oska', 'placebo', 'pizzera-jaus', 'bilderbuch', 'wanda', 'bob-dylan'];
window.EXTRA = {
  'bilderbuch': { id: 'bilderbuch', name: 'Bilderbuch', kind: 'Pop', img: '', events: [] },
  'wanda': { id: 'wanda', name: 'Wanda', kind: 'Pop', img: '', events: [] },
};
window.byId = Object.fromEntries(ARTISTS.map(a => [a.id, a]));
window.artist = id => byId[id] || EXTRA[id];
window.isFollowed = id => SIGNED_IN && FOLLOWED.includes(id);

// Spielarten für Filter und Regale
window.GROUP = a => {
  if (['Kabarett', 'Lesung'].includes(a.kind)) return 'Kabarett';
  if (['Theater', 'Musical'].includes(a.kind)) return 'Bühne';
  if (['Klassik', 'Jazz'].includes(a.kind)) return 'Klassik & Jazz';
  return 'Konzerte';
};
window.upcoming = a => a.events.filter(e => e.iso >= TODAY_ISO);
window.nextEvent = a => upcoming(a)[0];
window.cityLine = e => e.venue && e.city && !e.venue.toLowerCase().includes(e.city.toLowerCase()) ? `${e.venue}, ${e.city}` : (e.venue || e.city);
window.initials = n => n.trim()[0].toUpperCase();
// Programmtitel ohne den Künstlernamen davor („Alex Kristan - Born to be Child" wird „Born to be Child");
// bleibt nichts übrig, steht der Saal fett.
window.progTitle = (a, e) => {
  const title = e.title || '';
  if (!title.toLowerCase().startsWith(a.name.toLowerCase())) return title || e.venue;
  const t = title.slice(a.name.length).replace(/^[\s\-–:|,]+/, '').trim();
  return t || e.venue || title;
};
// Nebenzeile: Uhrzeit und Ort; steht der Saal schon fett, nur die Stadt.
window.progSub = (a, e) => [e.time ? e.time + ' Uhr' : '', progTitle(a, e) === e.venue ? e.city : cityLine(e)].filter(Boolean).join(', ');

window.weekOf = iso => iso <= '2026-11-08' ? 'w1' : iso <= '2026-11-15' ? 'w2' : 'later';
window.WEEKS = { w1: ['Diese Woche', '2. bis 8. November'], w2: ['Nächste Woche', '9. bis 15. November'], later: ['Später im November', 'ab 16. November'] };

window.followBtn = (id, cls = '') => {
  const on = isFollowed(id);
  return `<button type="button" class="fol ${on ? 'on' : ''} ${cls}" data-follow="${id}" aria-label="${on ? 'Nicht mehr folgen' : 'Folgen'}: ${artist(id).name}">${on ? 'Folgst du' : 'Folgen'}</button>`;
};
window.avatar = (a, size = 46) => a.img
  ? `<img class="av" src="${a.img}" alt="" width="${size}" height="${size}" loading="lazy" referrerpolicy="no-referrer">`
  : `<span class="av fb" style="width:${size}px;height:${size}px">${initials(a.name)}</span>`;

// Optimistischer Folgen-Zustand im Mockup
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-follow]');
  if (!b) return;
  ev.stopPropagation();
  if (!SIGNED_IN) { location.search = '?in'; return; }
  const id = b.dataset.follow, on = b.classList.contains('on');
  if (on) FOLLOWED.splice(FOLLOWED.indexOf(id), 1); else FOLLOWED.push(id);
  document.querySelectorAll(`[data-follow="${id}"]`).forEach(x => { x.classList.toggle('on', !on); x.textContent = on ? 'Folgen' : 'Folgst du'; });
  const t = document.getElementById('toast');
  if (t) { t.textContent = on ? `${artist(id).name} entfernt.` : `Du folgst ${artist(id).name}. Neue Termine in Österreich bekommst du per Mail.`; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3500); }
});

// Künstlerblatt: alle Termine mit Ticketlink, ähnliche Künstler, Quelle
window.similarTo = a => ARTISTS.filter(x => x.id !== a.id && GROUP(x) === GROUP(a)).slice(0, 4);
window.sheetHtml = a => {
  const evs = upcoming(a);
  return `
  <div class="sh-head">${avatar(a, 72)}<div><h2>${a.name}</h2><p>${a.kind}${evs.length ? `, ${evs.length} Termin${evs.length === 1 ? '' : 'e'} in Österreich` : ', derzeit kein Termin in Österreich'}</p></div>${followBtn(a.id, 'big')}</div>
  ${evs.length ? `<ul class="sh-dates">${evs.map(e => `<li><span class="d"><b>${e.wd} ${e.d}.</b><small>${e.m}</small></span><span class="min"><b>${progTitle(a, e)}</b><small>${progSub(a, e)}</small></span><a class="tix" href="#" aria-label="Tickets für ${e.title}">Tickets</a></li>`).join('')}</ul>`
    : `<p class="sh-empty">Sobald ${a.name} einen Termin in Österreich hat, steht er hier. Mit Folgen bekommst du ihn per Mail.</p>`}
  <div class="sh-sim"><h3>Wer ${a.name} mag, geht auch zu</h3><div class="sim-row">${similarTo(a).map(s => `<a href="#" class="sim" data-open="${s.id}">${avatar(s, 44)}<b>${s.name}</b><small>${nextEvent(s) ? nextEvent(s).day : ''}</small></a>`).join('')}</div></div>
  <p class="sh-src">Termine und Tickets von oeticket. Spotify-Link einfügen funktioniert auch: wir finden den Künstler.</p>`;
};
window.openSheet = id => {
  const a = artist(id); if (!a) return;
  let s = document.getElementById('sheet');
  if (!s) { s = document.createElement('div'); s.id = 'sheet'; s.innerHTML = '<div class="sh-bg" data-close></div><div class="sh" role="dialog" aria-modal="true"><button type="button" class="sh-x" data-close aria-label="Schließen">×</button><div class="sh-body"></div></div>'; document.body.appendChild(s); }
  s.querySelector('.sh-body').innerHTML = sheetHtml(a);
  s.classList.add('open'); document.body.classList.add('noscroll');
};
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { const s = document.getElementById('sheet'); if (s) { s.classList.remove('open'); document.body.classList.remove('noscroll'); } } });
document.addEventListener('click', ev => {
  const o = ev.target.closest('[data-open]');
  if (o) { ev.preventDefault(); openSheet(o.dataset.open); return; }
  if (ev.target.closest('[data-close]')) { document.getElementById('sheet').classList.remove('open'); document.body.classList.remove('noscroll'); }
});

window.CHROME_CSS = `
.nav .links .on{background:var(--h2);color:var(--ink)}
.tabbar span.on{color:var(--ink)}
.av{width:46px;height:46px;border-radius:50%;object-fit:cover;background:var(--inset);flex:none}
.av.fb{display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:var(--ink50);border:1px solid var(--h3)}
.fol{width:88px;height:30px;font-size:12px;font-weight:700;padding:0;border-radius:999px;border:1px solid var(--h4);color:var(--ink);text-align:center;white-space:nowrap;flex:none}
.fol:hover{background:var(--h2)}
.fol.on{background:var(--amber);border-color:var(--amber);color:#0a0a0c}
.fol.big{width:110px;height:38px;font-size:13.5px}
#toast{position:fixed;left:50%;bottom:90px;transform:translate(-50%,20px);opacity:0;transition:.25s;background:#fff;color:#0a0a0c;font-size:13.5px;font-weight:600;padding:12px 18px;border-radius:12px;z-index:40;max-width:min(92vw,480px);text-align:center;pointer-events:none}
#toast.show{opacity:1;transform:translate(-50%,0)}
@media(min-width:721px){#toast{bottom:32px}}
.noscroll{overflow:hidden}
/* Künstlerblatt */
#sheet{position:fixed;inset:0;z-index:30;display:none}
#sheet.open{display:block}
#sheet .sh-bg{position:absolute;inset:0;background:rgba(0,0,0,.6)}
#sheet .sh{position:absolute;right:0;top:0;bottom:0;width:min(520px,100%);background:var(--surface);border-left:1px solid var(--h3);overflow-y:auto;padding:28px 28px 40px}
@media(max-width:720px){#sheet .sh{left:0;right:0;top:auto;bottom:0;width:auto;max-height:88vh;border-left:0;border-top:1px solid var(--h3);border-radius:18px 18px 0 0;padding:20px 16px 90px}}
.sh-x{position:absolute;right:14px;top:12px;width:34px;height:34px;border-radius:50%;border:1px solid var(--h3);font-size:20px;line-height:1;display:grid;place-items:center;color:var(--ink70)}
.sh-head{display:flex;align-items:center;gap:16px;margin:4px 40px 18px 0}
.sh-head>div{flex:1;min-width:0}
.sh-head h2{margin:0;font-size:24px;font-weight:800;letter-spacing:-.03em;line-height:1.1}
.sh-head p{margin:4px 0 0;font-size:13px;color:var(--ink50)}
.sh-head .av{width:72px;height:72px}
.sh-dates{list-style:none;margin:0;padding:0;border-top:1px solid var(--h2)}
.sh-dates li{display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--h2)}
.sh-dates .d b{display:block;font-size:14px;font-weight:800;letter-spacing:-.01em}
.sh-dates .d small{display:block;font-size:11.5px;color:var(--ink50)}
.sh-dates .min{min-width:0}
.sh-dates .min b{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sh-dates .min small{display:block;font-size:12px;color:var(--ink50);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tix{font-size:12.5px;font-weight:700;color:var(--ink);border:1px solid var(--h3);padding:7px 12px;border-radius:999px;white-space:nowrap}
.tix:hover{border-color:var(--h4)}
.sh-empty{font-size:14px;color:var(--ink70);line-height:1.5;padding:14px 0;border-top:1px solid var(--h2);border-bottom:1px solid var(--h2);margin:0}
.sh-sim{margin-top:26px}
.sh-sim h3{margin:0 0 10px;font-size:15px;font-weight:800;letter-spacing:-.02em}
.sim-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.sim{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;min-width:0}
.sim .av{width:56px;height:56px}
.sim b{font-size:12.5px;font-weight:700;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sim small{font-size:11px;color:var(--ink50)}
.sh-src{margin:26px 0 0;font-size:12px;color:var(--ink50);line-height:1.5}
/* Kopf der Seite, in allen Varianten gleich */
.head{padding:26px 0 14px;display:grid;grid-template-columns:1fr auto;gap:14px 40px;align-items:end}
.head h1{margin:0;font-size:40px;font-weight:800;letter-spacing:-.04em;line-height:1}
.head p{margin:8px 0 0;font-size:14px;color:var(--ink50)}
.head .searchbar{width:400px;height:46px}
@media(max-width:1000px){.head{grid-template-columns:1fr}.head .searchbar{width:100%}}
@media(max-width:720px){.head{padding-top:18px}.head h1{font-size:32px}}
/* Suchergebnis (Mock, aufgeklappt in Variante A) */
.sr{margin:10px 0 0;border:1px solid var(--h3);border-radius:14px;background:var(--elev);overflow:hidden}
.sr .r{display:grid;grid-template-columns:40px 1fr 88px;gap:12px;align-items:center;padding:9px 12px;border-top:1px solid var(--h2)}
.sr .r:first-child{border-top:0}
.sr .r .av{width:40px;height:40px}
.sr .r b{display:block;font-size:14px;font-weight:700}
.sr .r small{display:block;font-size:12px;color:var(--ink50)}
.sr .more{padding:10px 12px;font-size:12.5px;color:var(--ink70);border-top:1px solid var(--h2);background:var(--inset)}
.sr .more b{color:var(--ink)}
/* Deine Künstler (eingeloggt) */
.mine{margin:22px 0 0;padding:16px 0 18px;border-top:1px solid var(--h2);border-bottom:1px solid var(--h2)}
.mine .hd{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}
.mine h2{margin:0;font-size:19px;font-weight:800;letter-spacing:-.03em}
.mine .hd span{font-size:13px;color:var(--ink50)}
.mine .hd a{margin-left:auto;font-size:13px;font-weight:700;color:var(--ink70)}
.mine .row{display:flex;gap:18px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px}
.mine .row::-webkit-scrollbar{display:none}
.mine .me{flex:0 0 92px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:7px;min-width:0;cursor:pointer}
.mine .me .av{width:64px;height:64px}
.mine .me b{font-size:12.5px;font-weight:700;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mine .me small{font-size:11.5px;color:var(--ink50);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.mine .me small.soon{color:var(--amber);font-weight:700}
.mine .me.add .av{border:1px dashed var(--h4);background:transparent;display:grid;place-items:center;font-size:24px;color:var(--ink50)}
.mine .empty{font-size:14px;color:var(--ink70);line-height:1.5}
.mine .empty b{color:var(--ink)}
@media(max-width:720px){.mine .hd span{display:none}}
`;
window.mineHtml = () => {
  if (!SIGNED_IN) return '';
  const list = FOLLOWED.map(artist).filter(Boolean).sort((a, b) => (nextEvent(a)?.iso || '9') < (nextEvent(b)?.iso || '9') ? -1 : 1);
  const withDates = list.filter(a => nextEvent(a)).length;
  return `<section class="mine"><div class="hd"><h2>Deine Künstler</h2><span>${withDates} von ${list.length} mit Termin</span><a href="#">Benachrichtigungen</a></div>
  ${list.length ? `<div class="row">${list.map(a => { const e = nextEvent(a); return `<div class="me" data-open="${a.id}">${avatar(a, 64)}<b>${a.name}</b><small class="${e && e.iso <= '2026-11-08' ? 'soon' : ''}">${e ? e.day : 'noch kein Termin'}</small></div>`; }).join('')}<div class="me add"><span class="av">+</span><b>Hinzufügen</b><small>Name oder Spotify-Link</small></div></div>`
    : `<p class="empty">Noch keine Künstler. <b>Folgen</b> tippen, und du bekommst eine Mail, sobald ein Termin in Österreich dazukommt.</p>`}</section>`;
};
