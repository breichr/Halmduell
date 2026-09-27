import { describe, expect, test } from 'bun:test';
import { commonsDateiname } from './commons';

describe('commonsDateiname', () => {
  test.each([
    ['https://commons.wikimedia.org/wiki/File:Leptinotarsa_decemlineata_MHNT.jpg', 'Leptinotarsa decemlineata MHNT.jpg'],
    ['https://commons.m.wikimedia.org/wiki/File:Weizen%C3%A4hre.jpg', 'Weizenähre.jpg'],
    ['https://de.wikipedia.org/wiki/Kartoffelk%C3%A4fer#/media/Datei:Colorado_potato_beetle.jpg', 'Colorado potato beetle.jpg'],
    ['https://upload.wikimedia.org/wikipedia/commons/0/0b/Colorado_potato_beetle.jpg', 'Colorado potato beetle.jpg'],
    ['https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Colorado_potato_beetle.jpg/800px-Colorado_potato_beetle.jpg', 'Colorado potato beetle.jpg'],
    ['https://commons.wikimedia.org/w/index.php?title=File:Raps_Feld.png&oldid=1', 'Raps Feld.png'],
    ['Datei:Gelbrost.JPG', 'Gelbrost.JPG'],
    ['File:Gelbrost.jpeg', 'Gelbrost.jpeg'],
  ])('%s', (link, erwartet) => {
    expect(commonsDateiname(link)).toBe(erwartet);
  });

  test.each([
    'https://example.org/bild.jpg',
    'https://commons.wikimedia.org/wiki/Category:Wheat',
    'https://de.wikipedia.org/wiki/Kartoffelk%C3%A4fer',
    'Kartoffelkäfer',
    'Datei:Dokument.pdf',
  ])('kein Commons-Bild: %s', (link) => {
    expect(commonsDateiname(link)).toBeNull();
  });
});
