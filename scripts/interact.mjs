// Interactietest voor de rooktest (scripts/smoke.mjs): beantwoordt per vraagvorm (in het eerste hoofdstuk
// waar die vorm voorkomt) één vraag fout en daarna goed, en controleert dat de app nakijkt (feedback „bad” met een tip,
// dan „good”) en de voortgang opslaat. De goede antwoorden komen uit de YAML.
//
// Vormen: vertalen met woordtegels, vertalen door te typen, invullen (gap), meerkeuze (mc) en zoek de fout.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { expand } from '../src/core/check/normalize.js';

const plain = (s) => String(s ?? '').replace(/\*\*|\*|_/g, '').replace(/\s+/g, ' ').trim();
const first = (pattern) => expand(pattern)[0];

/** De hoofdstukken (vanaf H1) op volgorde. */
function loadChapters(root) {
  const dir = path.join(root, 'content', 'chapters');
  const chapters = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).map((f) => yaml.load(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter((c) => c.chapter >= 1).sort((a, b) => a.chapter - b.chapter);
  return chapters;
}

/**
 * Per vorm: een oefening met geschikte vragen (zonder steps), en per vraag de tekst op de kaart en hoe je
 * hem fout en goed beantwoordt. Een ronde toont niet altijd alle vragen: de test neemt de eerste die er staat.
 */
export function cases(root) {
  const chapters = loadChapters(root);
  const kinds = [
    { kind: 'translate-tiles', ok: (it) => it.type === 'translate' && !/[[{]/.test(it.answers[0]) && it.answers[0].split(' ').length <= 6,
      make: (it) => ({ text: plain(it.prompt), right: first(it.answers[0]) }) },
    { kind: 'translate-typen', ok: (it) => it.type === 'translate',
      make: (it) => ({ text: plain(it.prompt), right: first(it.answers[0]), wrong: 'xyz' }) },
    { kind: 'gap', ok: (it) => it.type === 'gap' && it.gaps?.length === 1 && !it.gaps[0].options,
      make: (it) => ({ text: plain(it.text.split('___')[0]).replace(/\(.*$/, '').trim(), right: first(it.gaps[0].answers[0]), wrong: 'xyz' }) },
    { kind: 'mc', ok: (it) => it.type === 'mc' && typeof it.answer === 'number' && it.options.length >= 2,
      // Op tekst kiezen: de opties kunnen geschud zijn.
      make: (it) => ({ text: plain(it.prompt), right: plain(it.options[it.answer]), wrong: plain(it.options[it.answer === 0 ? 1 : 0]) }) },
    { kind: 'findError', ok: (it) => it.type === 'findError' && Array.isArray(it.wrong),
      // De woorden staan als losse tegels op de kaart: zoek op het langste woord.
      make: (it) => ({ text: [...plain(it.sentence).split(' ')].sort((a, b) => b.length - a.length)[0], right: first(it.answers[0]), wrong: it.wrong }) },
  ];
  const out = [];
  // Per vorm het eerste hoofdstuk en de eerste oefening met zulke vragen.
  for (const k of kinds) {
    for (const ch of chapters) {
      const ex = ch.sections.flatMap((s) => s.exercises ?? []).find((e) => (e.items ?? []).some(k.ok));
      if (!ex) continue;
      out.push({ kind: k.kind, chapter: ch.chapter, ex, items: ex.items.filter(k.ok).map((it) => ({ it, ...k.make(it) })) });
      break;
    }
  }
  return out;
}

/** Speelt alle gevallen af in `page`. Geeft een lijst problemen terug. */
export async function interact(page, base, root) {
  page.setDefaultTimeout(5000);
  const list = cases(root);
  const problems = [];
  const fail = (c, msg) => problems.push(`[interactie ${c.kind}] H${c.chapter} ${c.ex.id} ${c.it?.id ?? ''}: ${msg}`);

  for (const c of list) {
    try {
      await play(c);
    } catch (e) {
      fail(c, e.message.split('\n')[0]);
    }
  }
  if (list.length < 5) problems.push(`[interactie] maar ${list.length} van de 5 vraagvormen gevonden`);
  return problems;

  async function play(c) {
    await page.goto(`${base}#/`);
    await page.evaluate(() => localStorage.clear());
    // Opnieuw laden: de app houdt de voortgang ook in het geheugen.
    await page.goto(`${base}#/k/${c.chapter}/o/${c.ex.id}`);
    await page.reload();
    await page.waitForSelector('article.item', { timeout: 5000 });
    // De eerste kaart op het scherm met een van deze vragen (de tekst staat erin; geschud of niet).
    let card = null;
    for (const cand of c.items) {
      const l = page.locator(`article.item.type-${cand.it.type}`).filter({ hasText: cand.text }).first();
      if (await l.count()) { card = l; Object.assign(c, cand); break; }
    }
    if (!card) return fail(c, `geen kaart gevonden van de ${c.items.length} vragen`);
    const feedback = card.locator('.feedback');
    const check = card.getByRole('button', { name: 'Controleer' });
    const expectFeedback = async (cls, what) => {
      try {
        await card.locator(`.feedback.${cls}`).waitFor({ timeout: 3000 });
      } catch {
        fail(c, `${what}: verwacht feedback „${cls}”, kreeg „${await feedback.getAttribute('class')}”: ${(await feedback.textContent())?.slice(0, 80)}`);
        return false;
      }
      return true;
    };

    if (c.kind === 'translate-tiles') {
      const words = c.right.replace(/[.!?]$/, '').split(' ');
      // Een tegel: het woord, eventueel met leesteken; hoofdletters tellen niet (tegels beginnen klein).
      const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[.,!?]$/, '');
      const tile = (w) => card.locator('.chips.bank .chip', { hasText: new RegExp(`^${esc(w)}[.,!?]?$`, 'i') }).first();
      // Eerst fout: de tegels in omgekeerde volgorde.
      for (const w of [...words].reverse()) await tile(w).click();
      await check.click();
      if (!(await expectFeedback('bad', 'omgekeerde volgorde'))) return;
      // Leeg maken: elke tegel in de zin terugtikken.
      while (await card.locator('.chips.line .chip').count()) await card.locator('.chips.line .chip').first().click();
      for (const w of words) await tile(w).click();
      await check.click();
      await expectFeedback('good', 'goede volgorde');
    } else if (c.kind === 'translate-typen' || c.kind === 'gap') {
      const switchBtn = card.locator('.input-switch', { hasText: 'Liever typen' });
      if (await switchBtn.count()) await switchBtn.click();
      const input = card.locator('input[type="text"], textarea').first();
      await input.fill(c.wrong);
      await check.click();
      if (!(await expectFeedback('bad', 'fout antwoord'))) return;
      if (!(await feedback.textContent())?.trim()) fail(c, 'fout antwoord zonder tip');
      await input.fill(c.right);
      await check.click();
      await expectFeedback('good', 'goed antwoord');
    } else if (c.kind === 'mc') {
      const option = (t) => card.locator('.option').filter({ has: page.getByText(t, { exact: true }) }).first();
      await option(c.wrong).click();
      if (!(await expectFeedback('bad', 'fout gekozen'))) return;
      await option(c.right).click();
      await expectFeedback('good', 'goed gekozen');
    } else if (c.kind === 'findError') {
      const chips = card.locator('.chips.find-error .chip');
      const ok = (await chips.count()) - 1 === c.wrong.at(-1) ? 0 : c.wrong.at(-1) + 1;
      await chips.nth(ok).click(); // een woord dat wel klopt
      if (!(await expectFeedback('bad', 'goed woord aangeklikt'))) return;
      await chips.nth(c.wrong[0]).click();
      // Daarna verbeteren: met tegels of (na „Liever typen”) door te typen.
      await card.locator('.correction:not([hidden])').waitFor({ timeout: 3000 });
      const fixSwitch = card.locator('.correction .input-switch', { hasText: 'Liever typen' });
      if (await fixSwitch.count()) await fixSwitch.click();
      const input = card.locator('.correction input[type="text"], .correction textarea').first();
      try { await input.waitFor({ timeout: 3000 }); } catch { return fail(c, 'geen invoer om te verbeteren na het foute woord'); }
      await input.fill(c.right);
      await check.click();
      await expectFeedback('good', 'verbeterde zin');
    }

    // De voortgang staat in localStorage, met het id van de vraag.
    if (c.it.id) {
      const saved = await page.evaluate((id) => Object.keys(localStorage).filter((k) => k.endsWith(':progress:v2')).some((k) => localStorage.getItem(k).includes(id)), c.it.id);
      if (!saved) fail(c, 'voortgang niet opgeslagen');
    }
  }
}
