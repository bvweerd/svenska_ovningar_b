import { describe, it, expect } from 'vitest';
import { installAdvice, showIntro } from '../src/onboarding.js';

const base = { standalone: false, touch: true, canPrompt: false, ios: false, used: true, visits: 1, hint: null, now: 1000 };

describe('installatieadvies', () => {
  it('niet in de app zelf en niet op een computer', () => {
    expect(installAdvice({ ...base, standalone: true })).toBe(null);
    expect(installAdvice({ ...base, touch: false })).toBe(null);
  });
  it('pas na een gemaakte vraag of een tweede bezoek', () => {
    expect(installAdvice({ ...base, used: false, visits: 1 })).toBe(null);
    expect(installAdvice({ ...base, used: false, visits: 2 })).toBe('android');
    expect(installAdvice({ ...base, used: true, visits: 1 })).toBe('android');
  });
  it('knop als de browser kan installeren, anders stappen voor iOS of Android', () => {
    expect(installAdvice({ ...base, canPrompt: true })).toBe('prompt');
    expect(installAdvice({ ...base, ios: true })).toBe('ios');
  });
  it('„Niet nu” wacht tot de datum, „Niet meer tonen” voorgoed', () => {
    expect(installAdvice({ ...base, hint: { until: 2000 } })).toBe(null);
    expect(installAdvice({ ...base, hint: { until: 500 } })).toBe('android');
    expect(installAdvice({ ...base, hint: { never: true } })).toBe(null);
  });
});

describe('Zo werkt het', () => {
  it('tot je hem sluit of iets hebt gemaakt', () => {
    expect(showIntro({ introDone: false, used: false })).toBe(true);
    expect(showIntro({ introDone: true, used: false })).toBe(false);
    expect(showIntro({ introDone: false, used: true })).toBe(false);
  });
});
