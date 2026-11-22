import { describe, it, expect } from 'vitest';
import { splitSentences, voiceScore, voiceGender, noSwedishVoice, isMobileDevice } from '../src/platform/speech.js';
import { spokenText } from '../src/core/items/index.js';
import { gradeSort } from '../src/core/check/grade.js';

describe('splitSentences', () => {
  it('splitst op zinnen en haalt opmaak weg', () => {
    expect(splitSentences('Hej! Jag heter **Sanne**. Bor du här?')).toEqual(['Hej!', 'Jag heter Sanne.', 'Bor du här?']);
  });
  it('houdt een zin zonder punt', () => {
    expect(splitSentences('Med vänliga hälsningar')).toEqual(['Med vänliga hälsningar']);
  });
  it('leeg blijft leeg', () => expect(splitSentences('  ')).toEqual([]));
  it('knipt heel lange zinnen bij komma’s', () => {
    const long = Array.from({ length: 30 }, (_, i) => `ord${i} ord`).join(', ') + '.';
    expect(splitSentences(long).length).toBeGreaterThan(1);
  });
});

describe('voiceScore', () => {
  it('geeft natuurlijke Zweedse stemmen voorrang', () => {
    const a = voiceScore({ name: 'Microsoft Sofie Online (Natural) - Swedish (Sweden)', lang: 'sv-SE' });
    const b = voiceScore({ name: 'espeak-ng Swedish', lang: 'sv' });
    expect(a).toBeGreaterThan(b);
  });
});

describe('spokenText', () => {
  it('vult gaten in en laat hints weg', () => {
    expect(spokenText({ type: 'gap', text: 'Huset ___ (bygga) 1925.', gaps: [{ answers: ['byggdes'] }] })).toBe('Huset byggdes 1925.');
  });
  it('knipt het label voor een dubbele punt weg', () => {
    expect(spokenText({ type: 'mc', prompt: '**stanna** (blijven): Vi ___ hemma.', options: ['stannar', 'x'], answer: 0 })).toBe('Vi stannar hemma.');
  });
  it('kiest de eerste variant van een antwoord', () => {
    expect(spokenText({ type: 'transform', prompt: 'x', answers: ['{I går|Igår} stals min cykel.'] })).toBe('I går stals min cykel.');
  });
  it('dialoog zonder namen', () => {
    expect(spokenText({ type: 'dialogue', lines: ['Anna: Hej!', 'Olle: Hej då!', 'Anna: Ses!'] })).toBe('Hej! Hej då! Ses!');
  });
  it('niets bij koppelen', () => expect(spokenText({ type: 'match', pairs: [] })).toBe(null));
});

describe('gradeSort', () => {
  const item = { categories: ['a', 'b'], items: [{ text: 'x', cat: 0 }, { text: 'y', cat: 1, tip: 'denk na' }] };
  it('alles goed', () => expect(gradeSort([0, 1], item).correct).toBe(true));
  it('leeg', () => expect(gradeSort([0, null], item).empty).toBe(true));
  it('fout met tip', () => {
    const r = gradeSort([0, 0], item);
    expect(r.correct).toBe(false);
    expect(r.fields).toEqual([true, false]);
    expect(r.tip).toContain('denk na');
  });
});

describe('voiceGender', () => {
  it('herkent bekende Zweedse stemmen', () => {
    expect(voiceGender({ name: 'Microsoft Mattias Online (Natural) - Swedish (Sweden)' })).toBe('m');
    expect(voiceGender({ name: 'Microsoft Sofie Online (Natural) - Swedish (Sweden)' })).toBe('v');
    expect(voiceGender({ name: 'Microsoft Bengt - Swedish (Sweden)' })).toBe('m');
    expect(voiceGender({ name: 'Oskar (Enhanced)' })).toBe('m');
    expect(voiceGender({ name: 'Alva' })).toBe('v');
    expect(voiceGender({ name: 'Google svenska' })).toBe(null);
  });
});

describe('geen Zweedse stem', () => {
  const sv = { name: 'Alva', lang: 'sv-SE' };
  const nl = { name: 'Xander', lang: 'nl-NL' };
  const base = { ready: true, mobile: false, supported: true };
  it('alleen als de lijst geladen is en er geen Zweedse stem in staat', () => {
    expect(noSwedishVoice({ ...base, voices: [nl] })).toBe(true);
    expect(noSwedishVoice({ ...base, voices: [nl, sv] })).toBe(false);
    expect(noSwedishVoice({ ...base, voices: [], ready: false })).toBe(false);
  });
  it('niet op telefoons en tablets, en niet als voorlezen helemaal niet kan', () => {
    expect(noSwedishVoice({ ...base, voices: [], mobile: true })).toBe(false);
    expect(noSwedishVoice({ ...base, voices: [nl], supported: false })).toBe(false);
  });
  it('herkent telefoons en tablets', () => {
    expect(isMobileDevice('Mozilla/5.0 (Linux; Android 14) Chrome/130', 'Linux', 5)).toBe(true);
    expect(isMobileDevice('Mozilla/5.0 (Macintosh)', 'MacIntel', 5)).toBe(true);
    expect(isMobileDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/130', 'Win32', 0)).toBe(false);
  });
});

describe('voiceGender op Android en ChromeOS', () => {
  it('herkent de Zweedse labels van Google', () => {
    expect(voiceGender({ name: 'Kvinnlig röst 1' })).toBe('v');
    expect(voiceGender({ name: 'Mansröst 2' })).toBe('m');
  });
});
