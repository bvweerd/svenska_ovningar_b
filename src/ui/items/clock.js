// Klok: hoe laat is het?
import { h } from '../dom.js';
import { clockSpec } from '../../core/check/grade.js';
import { swedishTime } from '../../core/check/clock.js';
import { normalize } from '../../core/check/normalize.js';
import { prompt, sentenceField, sentenceLock } from './fields.js';

// ---------- Klok ----------
function clockSvg(time) {
  const [hh, mm] = time.split(':').map(Number);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'clock');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Klok die ${time} aanwijst`);
  const add = (tag, attrs) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    svg.append(e);
    return e;
  };
  add('circle', { cx: 50, cy: 50, r: 46, class: 'face' });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 2 * Math.PI;
    add('line', {
      x1: 50 + 38 * Math.sin(a), y1: 50 - 38 * Math.cos(a),
      x2: 50 + 43 * Math.sin(a), y2: 50 - 43 * Math.cos(a), class: 'tick',
    });
  }
  const hand = (angle, len, cls) => add('line', { x1: 50, y1: 50, x2: 50 + len * Math.sin(angle), y2: 50 - len * Math.cos(angle), class: cls });
  hand((((hh % 12) + mm / 60) / 12) * 2 * Math.PI, 24, 'hour');
  hand((mm / 60) * 2 * Math.PI, 35, 'minute');
  add('circle', { cx: 50, cy: 50, r: 2.5, class: 'pin' });
  return svg;
}

export function clock(item, ctx) {
  const spec = clockSpec(item);
  const f = sentenceField(spec, ctx, { label: 'Hoe laat is het?', topic: 'klockan' });
  const el = h('div', { class: 'clock-item' }, clockSvg(item.time), h('div', {}, prompt(item.prompt ?? 'Hoe laat is het?'), f.field.el));
  // Er zijn vaak twee goede vormen (tjugo över tio = tio i halv elva). Met tegels kun je er maar één
  // leggen; na een goed antwoord laten we de andere zien.
  const forms = swedishTime(item.time);
  const also = h('p', { class: 'hint', lang: 'sv', hidden: true });
  el.append(also);
  const check = () => {
    const res = f.check();
    const given = normalize(f.field.value());
    const other = forms.filter((t) => !given.endsWith(normalize(t)));
    if (res.correct && forms.length > 1 && other.length) {
      also.textContent = `Ook goed: ${other.join(' / ')}`;
      also.hidden = false;
    }
    return res;
  };
  return { el, check, reveal: f.reveal, lock: sentenceLock(f, el) };
}
