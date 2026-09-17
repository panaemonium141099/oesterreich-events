import { describe, expect, it } from 'vitest';
import { pickWikimediaCandidate, titleMatchesName } from '@/lib/activities/wikimedia-image';

describe('titleMatchesName', () => {
  it('lehnt Treffer ab, die nur ueber Stadt- oder Gattungswort passen', () => {
    expect(titleMatchesName('File:Oberes Belvedere Wien, Panorama.jpg', 'Wien Museum', 'Wien')).toBe(false);
    expect(titleMatchesName('File:180° Hafenmole Bregenz.jpg', 'Pfänderbahn Bregenz', 'Bregenz')).toBe(false);
    expect(titleMatchesName('File:Fohnsdorf-Gabelhofensiedlung.jpg', 'Aqualux Therme Fohnsdorf', 'Fohnsdorf')).toBe(false);
    expect(titleMatchesName('File:Altburgstelle Neurath bei Stainz.jpg', 'Wanderweg Stainz', 'Stainz')).toBe(false);
  });

  it('ein kurzes Einzel-Token reicht nicht ohne Ort oder vollen Namen', () => {
    expect(titleMatchesName('File:Chalet du Mont-Royal IMG 3972.JPG', 'Chalet Royal', 'Sankt Michael')).toBe(false);
    expect(titleMatchesName('File:Chalet Royal Sankt Michael.jpg', 'Chalet Royal', 'Sankt Michael')).toBe(true);
  });

  it('akzeptiert unterscheidungskraeftige Tokens', () => {
    expect(titleMatchesName('File:16-12-17-Murinsel Graz-RalfR.jpg', 'Murinsel Graz', 'Graz')).toBe(true);
    expect(titleMatchesName('File:Lurgrotte-1.jpg', 'Lurgrotte Semriach', 'Semriach')).toBe(true);
    expect(titleMatchesName('File:Lentos Kunstmuseum Linz 2008b.jpg', 'Lentos Kunstmuseum Linz', 'Linz')).toBe(true);
    expect(titleMatchesName('File:Schloss Schönbrunn Wien 2014.jpg', 'Schloss Schönbrunn', 'Wien')).toBe(true);
    expect(titleMatchesName('File:Grazer Uhrturm 2.JPG', 'Grazer Uhrturm', 'Graz')).toBe(true);
  });

  it('ohne unterscheidungskraeftige Tokens muessen alle Nicht-Orts-Tokens vorkommen', () => {
    expect(titleMatchesName('File:Dommuseum außen.JPG', 'Dom Museum Wien', 'Wien')).toBe(true);
    expect(titleMatchesName('File:Stephansdom Wien.jpg', 'Dom Museum Wien', 'Wien')).toBe(false);
    expect(titleMatchesName('File:Naturhistorisches Museum Wien.jpg', 'Wien Museum', 'Wien')).toBe(false);
    expect(titleMatchesName('File:Wien Museum Karlsplatz 2023.jpg', 'Wien Museum', 'Wien')).toBe(true);
  });
});

describe('pickWikimediaCandidate', () => {
  const page = (title: string, license = 'CC BY-SA 4.0', mime = 'image/jpeg') => ({
    title,
    imageinfo: [{ url: `https://upload.wikimedia.org/${title}`, thumburl: `https://upload.wikimedia.org/thumb/${title}`, mime, extmetadata: { LicenseShortName: { value: license }, Artist: { value: '<a href="x">Foto Bar</a>' } } }],
  });

  it('nimmt das erste passende, frei lizenzierte Foto und uebernimmt die Attribution', () => {
    const pick = pickWikimediaCandidate([page('File:Karte Graz.svg', 'CC BY-SA 4.0', 'image/svg+xml'), page('File:Hafenmole Bregenz.jpg'), page('File:Murinsel Graz Abend.jpg')], 'Murinsel', 'Graz');
    expect(pick?.url).toBe('https://upload.wikimedia.org/thumb/File:Murinsel Graz Abend.jpg');
    expect(pick?.license).toBe('CC BY-SA 4.0');
    expect(pick?.author).toBe('Foto Bar');
    expect(pick?.credit).toBe('Wikimedia Commons, CC BY-SA 4.0');
  });

  it('lehnt unfreie Lizenzen und Logos ab', () => {
    expect(pickWikimediaCandidate([page('File:Murinsel Graz.jpg', 'Fair use')], 'Murinsel', 'Graz')).toBeNull();
    expect(pickWikimediaCandidate([page('File:Murinsel Logo.png')], 'Murinsel', 'Graz')).toBeNull();
  });
});
