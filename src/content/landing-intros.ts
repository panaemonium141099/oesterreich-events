/**
 * Redaktionelle Intro-Texte für Landing-Pages.
 *
 * Rationale: reine Filter-Listings ohne Einführungstext werden von Search-
 * Engines als "thin content" eingestuft und schlechter geranked. Jeder hier
 * gepflegte Absatz ist:
 *   - originell (nicht von anderen Seiten kopiert)
 *   - spezifisch für die Region (keine austauschbaren Platzhalter)
 *   - fokussiert auf Nutzer-Mehrwert (Insider-Tipps, Saison-Kontext)
 *
 * Updates: nach jedem größeren Scope-Change oder Jahreszeitenwechsel.
 * Nicht auto-generieren — der menschliche Ton ist Teil des Signals.
 */

export interface LandingIntro {
  /** Kurzer Einleitungssatz unter H1 (1-2 Sätze, wird prominent gerendert). */
  lead: string;
  /** Hauptabsatz über die Region und Szene (80-160 Wörter). */
  body: string;
  /** Optional: ein zusätzlicher Abschnitt mit Tipps / Must-Sees. */
  tips?: string;
}

/**
 * Pro Bundesland — key = bundesland.id aus src/lib/bundeslaender.ts.
 */
export const BUNDESLAND_INTROS: Record<string, LandingIntro> = {
  burgenland: {
    lead: 'Zwischen Neusiedler See, Wein-Hügeln und pannonischer Ebene hat Burgenland eine Event-Szene, die weit über Tourismus-Klischees hinausgeht.',
    body: 'Die Saison startet hier früher als im Rest Österreichs. Ab April kippt die Nachbarschaft rund um Rust, Mörbisch und Podersdorf in den Veranstaltungsmodus — von Seefestspielen über Weinverkostungen an der Neusiedler-See-Radroute bis zu Kirtagen in praktisch jedem Dorf. Im Sommer gibt es fast kein Wochenende ohne Heuriger-Fest oder Open-Air-Konzert; im Winter dominieren Christkindlmärkte in Eisenstadt und die Schloss-Esterhazy-Konzertsaison. Burgenland ist außerdem Österreichs Festival-Hinterhof: Lovely Days, Nova Rock und Pannonia Fields liefern jedes Jahr drei Wochen Musik-Tourismus in der Region um Nickelsdorf.',
    tips: 'Wer authentisches Brauchtum sucht, hält im Herbst Ausschau nach Martini-Festen und Erntedank-Kirtagen in Oberpullendorf und Oberwart — dort läuft das abseits der Tourismus-Hauptachsen.',
  },

  wien: {
    lead: 'Wien ist Österreichs Event-Hauptstadt, nicht nur wegen der Größe — auch wegen der Dichte an Subszenen, die sich nirgendwo anders in dem Maß finden.',
    body: 'Zwischen Philharmoniker-Konzerten im Musikverein und Techno-Nächten in der Grelle Forelle oder im Flex liegen 10 U-Bahn-Stationen. Wien hat parallel aktiv: eine internationale Klassik-Szene (Musikverein, Konzerthaus, Staatsoper), eine Club- und Rave-Szene mit Resident-Advisor-Reichweite (Flex, Fluc, Volksgarten, Pratersauna, Werk), über 200 Theater- und Kabarett-Bühnen, und einen der größten Christkindlmarkt-Cluster Europas. Dazu kommen die Studentenszene um WU, TU, Uni Wien und BOKU, Freiluft-Events im Prater und auf der Donauinsel, und die Ball-Saison von November bis Fasching, die in Österreich ihresgleichen sucht.',
    tips: 'Für das dichteste Club-Programm lohnt sich der Donnerstag — viele Wiener Labels nutzen den Wochenstart für Resident-Nights mit günstigen Eintritten und besseren Chancen an der Tür.',
  },

  niederoesterreich: {
    lead: 'Niederösterreich ist flächenmäßig das größte Bundesland Österreichs — und das verteilt sich auch auf die Event-Landschaft.',
    body: 'Zwischen Krems an der Donau, dem Weinviertel, der Wachau und dem Industrieviertel im Süden liegen Welten. Die Wachau dreht sich um Weinfeste (Spitzer Marillenkirtag, Retzer Weinlesefest), Klassik (Grafenegg, Schallaburg) und Schiffs-Events auf der Donau. Im Weinviertel gibt es das dichteste Kirtags-Netzwerk Österreichs — fast jedes Wochenende irgendwo ein Dorffest mit Blasmusik. Das Industrieviertel um Wiener Neustadt und Baden bringt größere Konzerthallen und Musical-Produktionen. Niederösterreich hat keine eigene Metropole, dafür viele Klein- und Mittelstädte mit eigenem kulturellen Puls: Krems, St. Pölten, Klosterneuburg, Wiener Neustadt, Amstetten.',
    tips: 'Wachau-Sommer: Marillenfest in Spitz, Donau-Kino Open-Air in Krems, und die Grafenegg-Klassik-Saison. Im Spätsommer überschneiden sich alle drei — Tickets sollte man 6+ Wochen vorher buchen.',
  },

  oberoesterreich: {
    lead: 'Oberösterreich pendelt zwischen urbanem Linz, alpinem Salzkammergut und der Industrieachse Wels-Steyr-Enns — entsprechend breit das Event-Spektrum.',
    body: 'Linz hat mit Ars Electronica eines der international wichtigsten Digital-Art-Festivals und das Lentos-Museum als kulturellen Anker. Die Clubszene um das Posthof, die Stadtwerkstatt und das KAPU bespielt mehrere Nächte pro Woche. Im Salzkammergut dominieren Seefeste am Traunsee, Attersee und Hallstätter See, dazu das Narzissenfest in Bad Aussee und die Salzburger Festspiel-Auslaufer in Bad Ischl. Steyr und Wels bringen regelmäßig Messen und Konzerte in kleineren Hallen. Und: Linz ist der zentrale Hub für die Student-Szene der JKU und Kunstuniversität, mit entsprechendem Nightlife-Angebot.',
    tips: 'Ars Electronica (meist Anfang September) legt für eine Woche die ganze Stadt lahm — wer dann in Linz übernachten will, sollte 3+ Monate vorher buchen.',
  },

  salzburg: {
    lead: 'Salzburg ist kulturell zweigeteilt: die Festspiel-Stadt im Sommer und die alpine Event-Region rund um Zell am See, Saalbach und das Pinzgau im Rest des Jahres.',
    body: 'Die Salzburger Festspiele (Ende Juli bis Ende August) sind international das Aushängeschild — sechs Wochen mit Oper, Schauspiel und Konzerten, die die Stadt komplett umkrempeln. Außerhalb davon läuft Salzburg als klassische Tourismus-Destination: Mozart-Konzerte fast täglich, Krampusläufe im Advent, Rauhnächte in Werfen und im Lungau. Das Gasteinertal und das Gebiet um Zell am See-Kaprun sind parallel Event-Hubs für den Ski-Tourismus im Winter und Trail-Running-Events im Sommer. Die ARGEkultur und das Rockhouse in der Stadt Salzburg bespielen die Indie- und Konzert-Szene das ganze Jahr durch.',
    tips: 'Für Festspiel-Liebhaber mit kleinem Budget: die Siemens Festspielnächte übertragen ausgewählte Produktionen kostenlos auf dem Kapitelplatz. Keine Reservierung, kein Eintritt — Plätze füllen sich ab ca. 19 Uhr.',
  },

  steiermark: {
    lead: 'Die Steiermark bündelt in einem Bundesland drei sehr unterschiedliche Event-Regionen: Graz, das Ausseerland-Salzkammergut und die steirische Weinstraße.',
    body: 'Graz als Kulturhauptstadt 2003 hat das Erbe bis heute gepflegt — Kunsthaus, Schauspielhaus und die Oper bespielen die Kern-Szene, der Murinsel-Sommer und die Styriarte füllen die warme Jahreszeit mit Festival-Programm. Die Postgarage, das PPC und die Orpheum-Extra sind die etablierten Indie- und Club-Venues. Im Ausseerland überlagern sich Narzissenfest, Kirtage und Wallfahrten mit alpinem Tourismus. Die steirische Weinstraße rund um Gamlitz und Leutschach lebt von Buschenschenken-Festen, Weinverkostungen und Erntedank-Feiern. Dazu: Aflenz-Splashline, Nova Rock-Nachbarschaft, und die Grazer Studentenszene mit Uni Graz, Med-Uni und Kunstuni.',
    tips: 'Styriarte-Tickets (Ende Juni bis Mitte Juli, Alte Musik) verkaufen sich typischerweise im März/April — spontane Entdecker haben oft bessere Chancen auf die Nebenreihen-Plätze in den Schloss-Konzerten.',
  },

  kaernten: {
    lead: 'Kärnten ist das „See-Bundesland" Österreichs — die Event-Saison dreht sich entsprechend stark um Wörthersee, Millstätter See, Weißensee und Ossiacher See.',
    body: 'Der Wörthersee bringt seit Jahrzehnten die größeren Open-Air-Konzerte und Beach-Partys, der Klagenfurter Wörthersee-Stadion ist zusätzlich Veranstaltungshub für Stadion-Acts. In der Zwischensaison verlagert sich der Fokus aufs Nassfeld, Bad Kleinkirchheim und die Skigebiete, wo Après-Ski-Events und Ski-Openings die Kalender füllen. Klagenfurt selbst hat mit dem Volkertheater, dem Stadthaus und dem Wörthersee-Saal stabile Konzerthallen; die Szene um Kulturverein Kramer und das Stadttheater Villach bringt regelmäßig Indie-Kultur. Typisch kärntnerisch: die Kufenstechen, Kirchtage und Wallfahrten, die das Brauchtum in den Seitentälern am Leben halten.',
    tips: 'Wörthersee-Klassik-Konzerte finden meist im Juli statt und sind oft unterbucht — die Abendkasse ist hier öfter eine Option als anderswo in Österreich.',
  },

  tirol: {
    lead: 'Tirol ist das Bundesland mit der klarsten Event-Saisonalität — Winter-Ski-Events und Sommer-Bergevents prägen den Kalender.',
    body: 'Innsbruck bildet das urbane Zentrum mit dem Treibhaus, dem Weekender-Club, der Bäckerei und dem Kulturzentrum P.M.K. als Szene-Venues. Die Ski-Openings in Ischgl, Sölden, St. Anton und Obergurgl ziehen im November und Dezember eine internationale Après-Ski-Publikum an. Im Sommer verschiebt sich das Zentrum ins Zillertal (Alpenparty Zellberg Buam, Gauderfest in Zell am Ziller), ins Ötztal (Trail-Running, Mountainbike-Events) und ins Pitztal. Tiroler Festspiele Erl (bei Kufstein) bringt im Sommer anspruchsvolle Oper. Die Schemenlaufzeit im Fasching — wie der Telfer Schleicherlauf — ist international als immaterielles UNESCO-Kulturerbe anerkannt.',
    tips: 'Für echte Tiroler Tradition lohnt sich ein Blick auf die Telfer, Imster und Rottenburger Fasnachtsläufe — die finden alle 3-5 Jahre statt und ziehen Zehntausende an.',
  },

  vorarlberg: {
    lead: 'Vorarlberg ist klein, aber dicht: Bodensee im Westen, Arlberg im Osten, und dazwischen eine Szene, die im Sommer auf dem Festspielhaus Bregenz und im Winter auf den Ski-Tourismus setzt.',
    body: 'Die Bregenzer Festspiele (Juli/August) auf der Seebühne gehören zum Welterbe des Musiktheaters — sie sind das Aushängeschild und belegen Bregenz als Event-Stadt weit über Österreich hinaus. Dornbirn und Feldkirch bringen mit dem Poolbar-Festival, dem Conrad-Sohm-Club und dem Spielboden eigene, kleinere Subszenen. Der Arlberg (Lech, Zürs, St. Anton — letzteres grenzt nach Tirol) ist Österreichs exklusivste Ski-Region mit eigenem Event-Kalender von Ski-Openings bis Tanzcafé Arlberg. Im Montafon, Bregenzerwald und im Walgau leben traditionelle Brauchtums-Events wie Funkenfeuer und Alpabtriebe fort.',
    tips: 'Poolbar-Festival in Feldkirch (Juli, Alte Bürgermühle) ist einer der liebenswertesten mittelgroßen Kultur-Spots in Westösterreich — kombiniert Club-Acts, Literatur und Ausstellungen.',
  },
};

/**
 * Key = city slug aus src/lib/landing-slugs.ts.
 * Nur für Städte gepflegt, für die wir gezielte Landing-Pages haben.
 */
export const STADT_INTROS: Record<string, LandingIntro> = {
  'wien': {
    lead: 'Wien hat eine der dichtesten Event-Landschaften Europas — mehrere Szenen parallel aktiv, jeden Tag der Woche.',
    body: 'Von Flex- und Fluc-Nächten bis Philharmoniker-Konzert im Musikverein, von Uni-Partys an der WU bis Bällen im Rathaus, von Indie-Shows im Wuk bis Weinfesten am Nussberg — Wien ist kein einzelnes Event-Ökosystem, sondern ein Dutzend. Die Seite bündelt das alles in eine durchsuchbare Karte, gefiltert nach dem was dich interessiert (Genre, Vibe, Preis, Zielgruppe). Besonders dicht wird es Donnerstag bis Samstag in den U-Bahn-Ringen U4, U6 und U2.',
  },
  'graz': {
    lead: 'Graz ist nach Wien Österreichs zweite Kulturmetropole — und die Steiermark-Hauptstadt spielt ihre Event-Saison das ganze Jahr durch.',
    body: 'Die Postgarage, das Orpheum-Extra und die PPC liefern die Club-Szene. Für Klassik, Schauspiel und Oper sind Opernhaus Graz und Schauspielhaus Graz die Anker. Der Grazer Uferboulevard an der Mur bringt im Sommer Open-Air-Events; Styriarte, Elevate Festival und diverse Uni-Termine füllen den Kalender zusätzlich. Graz hat rund 60.000 Studierende — der jugendliche Anteil am Nachtleben ist entsprechend hoch.',
  },
  'linz': {
    lead: 'Linz ist die Kulturstadt der Donau — durch Ars Electronica international bekannt, auf Lokalebene eine lebendige Konzert- und Club-Stadt.',
    body: 'Posthof, Stadtwerkstatt und KAPU sind die bekanntesten Venues für Indie und elektronische Musik. Das Lentos und das Ars Electronica Center bespielen die digitale und bildende Kunst. Klassisch geht es im Brucknerhaus und im Musiktheater. Dazu: Donauinsel-Events im Sommer, Advent auf dem Hauptplatz, und die JKU-Studenten-Szene um den Campus.',
  },
  'salzburg': {
    lead: 'Salzburg lebt kulturell von den Festspielen — aber auch abseits der sechs Sommerwochen ist die Stadt ein dichter Konzert- und Theater-Hub.',
    body: 'Die ARGEkultur und das Rockhouse bespielen die Indie-Szene, das Landestheater die klassische Bühne, und die Mozart-Konzerte laufen fast täglich in der Altstadt. Für die Ball-Saison ist Salzburg nach Wien die zweite Adresse in Österreich. Im Sommer verschiebt sich der Schwerpunkt in die Festspielhäuser; im Winter dominieren Christkindlmarkt am Residenzplatz und Krampusläufe in der Region.',
  },
  'innsbruck': {
    lead: 'Innsbruck ist Tirols urbaner Mittelpunkt und die Basis für alles, was in den umliegenden Alpen passiert.',
    body: 'Das Treibhaus, der Weekender-Club, die Bäckerei und das Kulturzentrum P.M.K. sind die etablierten Venues für Konzerte, DJ-Nights und Kunstausstellungen. Die Universität Innsbruck bringt eine studentische Nachtszene, vor allem im Viertel um die Templstraße. In der Weihnachtszeit werden die Christkindlmärkte in der Altstadt und in der Maria-Theresien-Straße europaweit beworben.',
  },
  'klagenfurt': {
    lead: 'Klagenfurt ist Kärntens Event-Zentrum am Wörthersee — die Saison kippt im Frühsommer in den Open-Air-Modus und läuft den ganzen Seesommer durch.',
    body: 'Rund um den Wörthersee und das Strandbad konzentrieren sich die großen Sommer-Events, Beach-Partys und die Stadion-Konzerte im Wörthersee-Stadion. In der Stadt bespielen das Stadttheater Klagenfurt, das Konzerthaus und die Szene-Locations die Kultur- und Club-Nächte. Wiederkehrende Fixpunkte sind der Altstadtzauber und die Lange Nacht der Chöre, dazu Kirchtage und Kufenstechen im Umland. Klagenfurt ist außerdem Uni-Stadt — die Alpen-Adria-Universität bringt eine studentische Szene mit entsprechendem Nightlife.',
  },
};
