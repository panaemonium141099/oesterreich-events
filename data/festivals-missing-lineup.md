# Festivals ohne Lineup-Daten (Stand: 2026-05-18)

93 Festivals haben aktuell keine Lineup-Daten — weder aus dem DB-Scraper (9 Festivals abgedeckt) noch aus dem Runtime-OG-Enrichment (14 weitere via JSON-LD oder `/lineup`-Subpath).

**Workflow zum manuellen Befüllen:**
1. `data/manual-lineups.template.json` nach `data/manual-lineups.json` kopieren.
2. Für jeden Slug die Lineup-URL der Festival-Site öffnen, Artist-Namen reinschreiben.
3. `npm run import:manual-lineups -- --dry-run` für Preview, dann ohne Flag schreiben.

JSON-Shape pro Slug:
```json
{
  "seefestspiele-mörbisch": ["Artist 1", "Artist 2"],
  "salzburger-festspiele": {
    "headliner": ["Big Name"],
    "support":   ["Smaller Act", "Another"]
  }
}
```

Sortiert nach Festivaldatum.

| Festival | Termin | Ort | Website | lasstreffen.at |
|---|---|---|---|---|
| On the Couch | 1/28/2026 | Wien | [eberhard.klingt.org](https://eberhard.klingt.org/projekte/on-the-couch/) | [öffnen](https://lasstreffen.at/festivals/on-the-couch) |
| Murszene Graz | 2/9/2026 | Graz | [www.murszene-graz.at](http://www.murszene-graz.at) | [öffnen](https://lasstreffen.at/festivals/murszene-graz) |
| Internationaler Musiksommer Bad Schallerbach | 2/11/2026 | Bad Schallerbach | [www.musiksommerbadschallerbach.at](http://www.musiksommerbadschallerbach.at/programm/) | [öffnen](https://lasstreffen.at/festivals/internationaler-musiksommer-bad-schallerbach) |
| Festwochen Gmunden | 2/12/2026 | Gmunden | [www.festwochen-gmunden.at](https://www.festwochen-gmunden.at) | [öffnen](https://lasstreffen.at/festivals/festwochen-gmunden) |
| Interpenetration | 2/19/2026 | Graz | [interpenetration.net](http://interpenetration.net) | [öffnen](https://lasstreffen.at/festivals/interpenetration) |
| Philharmonische Klänge / Hörgenuss | 3/22/2026 | verschiedene Orte | [www.kultur-land-leben.at](http://www.kultur-land-leben.at/) | [öffnen](https://lasstreffen.at/festivals/philharmonische-kl%C3%A4nge-h%C3%B6rgenuss) |
| Steirische Stifts- und Schlosskonzerte | 3/28/2026 | verschiedene Kulturstätten | [www.3skonzerte.at](http://www.3skonzerte.at) | [öffnen](https://lasstreffen.at/festivals/steirische-stifts-und-schlosskonzerte) |
| Viertelfestival Niederösterreich | 5/6/2026 | Mostviertel | [www.viertelfestival-noe.at](http://www.viertelfestival-noe.at) | [öffnen](https://lasstreffen.at/festivals/viertelfestival-nieder%C3%B6sterreich) |
| Internationale Barocktage Stift Melk | 5/21/2026 | Melk | [www.wachaukulturmelk.at](https://www.wachaukulturmelk.at/de/barocktagemelk/dasfest) | [öffnen](https://lasstreffen.at/festivals/internationale-barocktage-stift-melk) |
| Springfestival Graz | 5/21/2026 | Graz | [www.springfestival.at](http://www.springfestival.at) | [öffnen](https://lasstreffen.at/festivals/springfestival-graz) |
| Klassik im Burghof | 5/22/2026 | Klagenfurt | [www.klassikinklagenfurt.at](https://www.klassikinklagenfurt.at/) | [öffnen](https://lasstreffen.at/festivals/klassik-im-burghof) |
| Dynamo Festival | 5/29/2026 | Dornbirn | [www.dynamofestival.at](https://www.dynamofestival.at) | [öffnen](https://lasstreffen.at/festivals/dynamo-festival) |
| Arkadenkultur | 5/31/2026 | Salzburg | [www.arkadenkultur.at](https://www.arkadenkultur.at) | [öffnen](https://lasstreffen.at/festivals/arkadenkultur) |
| Festival Stummer Schrei | 6/5/2026 | Stumm | [www.stummerschrei.at](https://www.stummerschrei.at/) | [öffnen](https://lasstreffen.at/festivals/festival-stummer-schrei) |
| Festival des politischen Liedes | 6/5/2026 | Linz | [kv-willy.at](http://kv-willy.at/) | [öffnen](https://lasstreffen.at/festivals/festival-des-politischen-liedes) |
| Sommerszene - Festival | 6/8/2026 | Salzburg | [www.szene-salzburg.net](http://www.szene-salzburg.net) | [öffnen](https://lasstreffen.at/festivals/sommerszene-festival) |
| Wörthersee Classics | 6/18/2026 | Klagenfurt | [www.woertherseeclassics.com](http://www.woertherseeclassics.com) | [öffnen](https://lasstreffen.at/festivals/w%C3%B6rthersee-classics) |
| Clam Konzerte | 6/20/2026 | Burg Clam | [clamlive.at](https://clamlive.at) | [öffnen](https://lasstreffen.at/festivals/clam-konzerte) |
| Kunst & Musik Forum Golling | 6/23/2026 | Golling | [www.festspielegolling.at](http://www.festspielegolling.at) | [öffnen](https://lasstreffen.at/festivals/kunst-musik-forum-golling) |
| Tonspuren | 6/25/2026 | Leogang | [www.tonspurenamasitz.com](https://www.tonspurenamasitz.com/de/tonspuren-am-asitz-konzerte) | [öffnen](https://lasstreffen.at/festivals/tonspuren) |
| Styriarte | 6/26/2026 | Graz | [styriarte.com](https://styriarte.com/festivals/styriarte) | [öffnen](https://lasstreffen.at/festivals/styriarte) |
| Kultursommer im Rosengarten | 6/30/2026 | Linz | [www.rosengarten.cc](https://www.rosengarten.cc) | [öffnen](https://lasstreffen.at/festivals/kultursommer-im-rosengarten) |
| OÖ. Stiftskonzerte | 6/30/2026 | Linz | [www.stiftskonzerte.at](https://www.stiftskonzerte.at) | [öffnen](https://lasstreffen.at/festivals/o%C3%B6-stiftskonzerte) |
| Kultursommer Wien | 7/2/2026 | Wien | [kultursommer.wien](https://kultursommer.wien/musik/?lang=de) | [öffnen](https://lasstreffen.at/festivals/kultursommer-wien) |
| Carinthischer Sommer Ossiach - Villach | 7/2/2026 | Ossiach/Villach | [carinthischersommer.at](https://carinthischersommer.at) | [öffnen](https://lasstreffen.at/festivals/carinthischer-sommer-ossiach-villach) |
| KulturSommer Semmering | 7/2/2026 | Semmering | [www.kultursommer-semmering.at](https://www.kultursommer-semmering.at/) | [öffnen](https://lasstreffen.at/festivals/kultursommer-semmering) |
| Summa Cum Laude International Youth Music Festival | 7/3/2026 | Wien | [www.sclfestival.org](http://www.sclfestival.org/) | [öffnen](https://lasstreffen.at/festivals/summa-cum-laude-international-youth-music-festival) |
| Donauinselfest | 7/3/2026 | Wien | [donauinselfest.at](https://donauinselfest.at/?nofade) | [öffnen](https://lasstreffen.at/festivals/donauinselfest) |
| Musikfest Waidhofen | 7/3/2026 | Waidhofen/Thaya | [www.folkclub.at](https://www.folkclub.at) | [öffnen](https://lasstreffen.at/festivals/musikfest-waidhofen) |
| Cantus | 7/3/2026 | Salzburg | [cantusmm.com](http://cantusmm.com) | [öffnen](https://lasstreffen.at/festivals/cantus) |
| Kammermusikfest Lockenhaus | 7/8/2026 | Lockenhaus | [www.kammermusikfest.at](http://www.kammermusikfest.at) | [öffnen](https://lasstreffen.at/festivals/kammermusikfest-lockenhaus) |
| Impulstanz | 7/9/2026 | Wien | [www.impulstanz.com](https://www.impulstanz.com/) | [öffnen](https://lasstreffen.at/festivals/impulstanz) |
| Woodstockenboi | 7/9/2026 | Stockenboi | [www.woodstockenboi.org](https://www.woodstockenboi.org) | [öffnen](https://lasstreffen.at/festivals/woodstockenboi) |
| Schrammelklang Festival | 7/10/2026 | Litschau | [www.schrammelklang.at](http://www.schrammelklang.at) | [öffnen](https://lasstreffen.at/festivals/schrammelklang-festival) |
| Goldegger Blues & Folktage | 7/10/2026 | Schwarzach/Pongau | [www.argebluesfolk.com](http://www.argebluesfolk.com/) | [öffnen](https://lasstreffen.at/festivals/goldegger-blues-folktage) |
| Klassik am Dom | 7/10/2026 | Linz | [www.klassikamdom.at](https://www.klassikamdom.at/) | [öffnen](https://lasstreffen.at/festivals/klassik-am-dom) |
| Glatt & Verkehrt | 7/10/2026 | Krems | [www.glattundverkehrt.at](http://www.glattundverkehrt.at) | [öffnen](https://lasstreffen.at/festivals/glatt-verkehrt) |
| Wellenklänge | 7/10/2026 | Lunz am See | [www.wellenklaenge.at](http://www.wellenklaenge.at) | [öffnen](https://lasstreffen.at/festivals/wellenkl%C3%A4nge) |
| Neuberger Kulturtage | 7/11/2026 | Neuberg an der Mürz | [www.neuberger-kulturtage.org](https://www.neuberger-kulturtage.org) | [öffnen](https://lasstreffen.at/festivals/neuberger-kulturtage) |
| Lehar Festival Bad Ischl | 7/11/2026 | Bad Ischl | [www.leharfestival.at](http://www.leharfestival.at) | [öffnen](https://lasstreffen.at/festivals/lehar-festival-bad-ischl) |
| Altenburger Musikademie | 7/12/2026 | Wilhelmsburg | [ama.musique.at](https://ama.musique.at/) | [öffnen](https://lasstreffen.at/festivals/altenburger-musikademie) |
| Güssinger Kultur Sommer | 7/12/2026 | Güssing | [www.kultursommer.net](https://www.kultursommer.net/) | [öffnen](https://lasstreffen.at/festivals/g%C3%BCssinger-kultur-sommer) |
| Musical Sommer Amstetten | 7/14/2026 | Amstetten | [www.avb.am](https://www.avb.am/avb-musical-sommer-2026/) | [öffnen](https://lasstreffen.at/festivals/musical-sommer-amstetten) |
| Seefestspiele Mörbisch | 7/16/2026 | Mörbisch | [www.seefestspiele-moerbisch.at](http://www.seefestspiele-moerbisch.at) | [öffnen](https://lasstreffen.at/festivals/seefestspiele-m%C3%B6rbisch) |
| Salzburger Festspiele | 7/17/2026 | Salzburg | [www.salzburgerfestspiele.at](http://www.salzburgerfestspiele.at) | [öffnen](https://lasstreffen.at/festivals/salzburger-festspiele) |
| Ottensheim Open Air | 7/17/2026 | Ottensheim | [www.openair.ottensheim.at](http://www.openair.ottensheim.at) | [öffnen](https://lasstreffen.at/festivals/ottensheim-open-air) |
| Internationales Gitarrenfestival Seckau | 7/18/2026 | Seckau | [www.gitarre-seckau.at](http://www.gitarre-seckau.at) | [öffnen](https://lasstreffen.at/festivals/internationales-gitarrenfestival-seckau) |
| Nordkette Wetterleuchten | 7/18/2026 | Innsbruck | [www.wetterleuchten.at](http://www.wetterleuchten.at) | [öffnen](https://lasstreffen.at/festivals/nordkette-wetterleuchten) |
| Jazz im Donaupark | 7/19/2026 | Linz | [www.jazzpoint.at](https://www.jazzpoint.at/donaupark/ue_donaupark.php) | [öffnen](https://lasstreffen.at/festivals/jazz-im-donaupark) |
| METAStadt Open Air | 7/21/2026 | Wien | [www.metastadtopenairs.com](https://www.metastadtopenairs.com) | [öffnen](https://lasstreffen.at/festivals/metastadt-open-air) |
| Bregenzer Festspiele | 7/22/2026 | Bregenz | [www.bregenzerfestspiele.com](http://www.bregenzerfestspiele.com) | [öffnen](https://lasstreffen.at/festivals/bregenzer-festspiele) |
| Popfest Wien | 7/23/2026 | Wien | [popfest.at](https://popfest.at/) | [öffnen](https://lasstreffen.at/festivals/popfest-wien) |
| Musikfestival Steyr | 7/23/2026 | Steyr | [www.musikfestivalsteyr.at](https://www.musikfestivalsteyr.at/) | [öffnen](https://lasstreffen.at/festivals/musikfestival-steyr) |
| Festwochen der Alten Musik | 7/24/2026 | Innsbruck | [www.altemusik.at](http://www.altemusik.at) | [öffnen](https://lasstreffen.at/festivals/festwochen-der-alten-musik) |
| Kunstmue Festival | 7/24/2026 | Bad Goisern | [kunstmue.com](https://kunstmue.com) | [öffnen](https://lasstreffen.at/festivals/kunstmue-festival) |
| Rollin' Dudes | 7/24/2026 | Leutschach | [www.rollindudes.com](https://www.rollindudes.com/) | [öffnen](https://lasstreffen.at/festivals/rollin-dudes) |
| Outreach Festival | 7/30/2026 | Schwaz | [outreachmusic.org](https://outreachmusic.org) | [öffnen](https://lasstreffen.at/festivals/outreach-festival) |
| La Strada: Kunst findet Stadt | 7/31/2026 | Graz | [www.lastrada.at](http://www.lastrada.at) | [öffnen](https://lasstreffen.at/festivals/la-strada-kunst-findet-stadt) |
| Acoustic Campfire Festival | 7/31/2026 | Kindberg | [acoustic-campfire.at](https://acoustic-campfire.at) | [öffnen](https://lasstreffen.at/festivals/acoustic-campfire-festival) |
| La Guitarra Essencial | 8/4/2026 | Millstatt am See | [www.laguitarraesencial.com](https://www.laguitarraesencial.com/) | [öffnen](https://lasstreffen.at/festivals/la-guitarra-essencial) |
| jOpera - Jennersdorf Kultursommer | 8/5/2026 | Neuhaus am Klausenbach | [www.jopera.at](https://www.jopera.at) | [öffnen](https://lasstreffen.at/festivals/jopera-jennersdorf-kultursommer) |
| Musiksommer Korneuburg | 8/6/2026 | Korneuburg | [korneuburgermusiksommer.at](https://korneuburgermusiksommer.at/) | [öffnen](https://lasstreffen.at/festivals/musiksommer-korneuburg) |
| Bezau Beatz | 8/6/2026 | Bezau | [www.bezaubeatz.at](http://www.bezaubeatz.at) | [öffnen](https://lasstreffen.at/festivals/bezau-beatz) |
| Montafoner Resonanzen | 8/6/2026 | verschiedene Orte | [www.montafon.at](https://www.montafon.at/montafoner-resonanzen/de) | [öffnen](https://lasstreffen.at/festivals/montafoner-resonanzen) |
| Sunny Days | 8/7/2026 | Dietersdorf | [wakmusic.com](https://wakmusic.com/festivals/sunny-days-festival) | [öffnen](https://lasstreffen.at/festivals/sunny-days) |
| Allegro Vivo | 8/7/2026 | Horn | [www.allegro-vivo.at](https://www.allegro-vivo.at/de/) | [öffnen](https://lasstreffen.at/festivals/allegro-vivo) |
| Hiesige & Dosige | 8/7/2026 | Wieselburg | [hiesigeunddosige.at](http://hiesigeunddosige.at/) | [öffnen](https://lasstreffen.at/festivals/hiesige-dosige) |
| Picture On Festival | 8/7/2026 | Bildein | [www.pictureon.at](http://www.pictureon.at) | [öffnen](https://lasstreffen.at/festivals/picture-on-festival) |
| Hotelpupik Festival | 8/8/2026 | St. Lorenzen | [www.hotelpupik.org](http://www.hotelpupik.org) | [öffnen](https://lasstreffen.at/festivals/hotelpupik-festival) |
| Brucknertage | 8/13/2026 | St. Florian | [www.brucknertage.at](https://www.brucknertage.at/) | [öffnen](https://lasstreffen.at/festivals/brucknertage) |
| Afrika Tage Wien | 8/14/2026 | Wien | [wien.afrika-tage.de](http://wien.afrika-tage.de) | [öffnen](https://lasstreffen.at/festivals/afrika-tage-wien) |
| Grafenegg Festival | 8/14/2026 | Grafenegg | [www.grafenegg.com](https://www.grafenegg.com) | [öffnen](https://lasstreffen.at/festivals/grafenegg-festival) |
| Walser Herbst | 8/15/2026 | Blons | [www.walserherbst.at](http://www.walserherbst.at) | [öffnen](https://lasstreffen.at/festivals/walser-herbst) |
| Kaltenbach Open Air | 8/20/2026 | Spital am Semmering | [www.kaltenbach-openair.at](http://www.kaltenbach-openair.at) | [öffnen](https://lasstreffen.at/festivals/kaltenbach-open-air) |
| Jazzfest Saalfelden | 8/20/2026 | Saalfelden | [www.jazzsaalfelden.com](http://www.jazzsaalfelden.com) | [öffnen](https://lasstreffen.at/festivals/jazzfest-saalfelden) |
| Ausseer Barocktage | 8/21/2026 | Bad Aussee | [www.ausseerbarocktage.com](https://www.ausseerbarocktage.com/) | [öffnen](https://lasstreffen.at/festivals/ausseer-barocktage) |
| Kammermusikfest Hopfgarten | 8/29/2026 | Hopfgarten | [www.kammermusikfest.net](http://www.kammermusikfest.net) | [öffnen](https://lasstreffen.at/festivals/kammermusikfest-hopfgarten) |
| Volksstimmefest | 9/5/2026 | Wien | [www.volksstimmefest.at](https://www.volksstimmefest.at) | [öffnen](https://lasstreffen.at/festivals/volksstimmefest) |
| Festival Ars Electronica | 9/9/2026 | Linz | [ars.electronica.art](https://ars.electronica.art/news/de/) | [öffnen](https://lasstreffen.at/festivals/festival-ars-electronica) |
| Herbstlärm | 9/10/2026 | Sankt Johann im Pongau | [www.herbstlaerm.at](https://www.herbstlaerm.at/) | [öffnen](https://lasstreffen.at/festivals/herbstl%C3%A4rm) |
| Wanderbare Gipfelklaenge | 9/11/2026 | Scheibbs | [www.mostviertel.at](https://www.mostviertel.at/wanderbare-gipfelklaenge) | [öffnen](https://lasstreffen.at/festivals/wanderbare-gipfelklaenge) |
| Most & Jazz | 9/11/2026 | Fehring | [www.mostundjazz.com](http://www.mostundjazz.com) | [öffnen](https://lasstreffen.at/festivals/most-jazz) |
| Herbstgold | 9/16/2026 | Eisenstadt | [www.herbstgold.at](https://www.herbstgold.at/) | [öffnen](https://lasstreffen.at/festivals/herbstgold) |
| Musiktheatertage Wien | 9/16/2026 | Wien | [mttw.at](http://mttw.at/) | [öffnen](https://lasstreffen.at/festivals/musiktheatertage-wien) |
| Aufsteirern | 9/19/2026 | Graz | [www.aufsteirern.at](http://www.aufsteirern.at) | [öffnen](https://lasstreffen.at/festivals/aufsteirern) |
| Steirischer Herbst | 9/24/2026 | Graz | [www.steirischerherbst.at](http://www.steirischerherbst.at) | [öffnen](https://lasstreffen.at/festivals/steirischer-herbst) |
| STP Metalweekend | 9/25/2026 | St. Pölten | [www.facebook.com](https://www.facebook.com/stpmetalweekend/) | [öffnen](https://lasstreffen.at/festivals/stp-metalweekend) |
| Waves Vienna Festival | 10/1/2026 | Wien | [www.wavesvienna.com](https://www.wavesvienna.com) | [öffnen](https://lasstreffen.at/festivals/waves-vienna-festival) |
| Jazz & the City | 10/15/2026 | Salzburg | [www.salzburg-altstadt.at](https://www.salzburg-altstadt.at/de/salzburgjazz) | [öffnen](https://lasstreffen.at/festivals/jazz-the-city) |
| folk.art Festival | 10/21/2026 | Graz | [www.folkart.at](https://www.folkart.at/) | [öffnen](https://lasstreffen.at/festivals/folk-art-festival) |
| Viennale | 10/22/2026 | Wien | [www.viennale.at](https://www.viennale.at/de/festival) | [öffnen](https://lasstreffen.at/festivals/viennale) |
| Winterfest | 11/25/2026 | Salzburg | [www.winterfest.at](https://www.winterfest.at/) | [öffnen](https://lasstreffen.at/festivals/winterfest) |
| Impuls - impuls Festival | 2/8/2027 | Graz | [www.impuls.cc](http://www.impuls.cc) | [öffnen](https://lasstreffen.at/festivals/impuls-impuls-festival) |
