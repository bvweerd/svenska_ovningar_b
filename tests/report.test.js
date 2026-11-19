import { describe, it, expect } from 'vitest';
import { reportPayload } from '../src/report.js';
import { REPORT_REPO } from '../src/config.js';

// De Worker zelf heeft eigen tests: worker/index.test.js (alleen in de B1–B2-repo).
describe('reportPayload', () => {
  it('neemt de plaats van de vraag over', () => {
    const item = { type: 'gap', text: 'a ___' };
    const p = reportPayload({ item, ref: { ch: 19, ex: { id: 'x', title: 'X' }, idx: 0 }, number: 4, message: ' fout ', answer: 'b', token: 't', page: 'p' });
    expect(p).toMatchObject({ repo: REPORT_REPO, message: 'fout', shownNumber: 4, chapter: 19, exercise: 'x', exerciseTitle: 'X', itemIndex: 0, itemId: null, itemType: 'gap', token: 't' });
    expect(JSON.parse(p.item)).toEqual(item);
  });
  it('geeft de vraag-id mee', () => {
    const p = reportPayload({ item: { id: 'k7q2', type: 'gap' }, ref: { ch: 19, ex: { id: 'x', title: 'X' }, idx: 5 }, message: 'fout' });
    expect(p).toMatchObject({ itemId: 'k7q2', itemIndex: 5 });
  });
  it('werkt ook zonder plaats (snelle rondes)', () => {
    const p = reportPayload({ item: { type: 'mc' }, message: 'x' });
    expect(p).toMatchObject({ chapter: null, exercise: null, itemIndex: null });
  });
});
