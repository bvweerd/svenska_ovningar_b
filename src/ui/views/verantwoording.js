// Verantwoording: hoe de oefenstof is opgebouwd en waarom. Dezelfde metingen als het rapport inhoud en
// didactiek in CI (scripts/content-report.mjs), bij elke build berekend (virtual:verantwoording), hier
// leesbaar gemaakt met eenvoudige grafieken in HTML. Elke grafiek heeft ook een tabel.
import { h, fill } from '../dom.js';
import { crumbs } from '../shared.js';

const nf = (x, d = 0) => Number(x).toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const STRANDS = [
  { key: 'input', label: 'Lezen en luisteren', short: 'input' },
  { key: 'output', label: 'Zelf iets zeggen of schrijven', short: 'output' },
  { key: 'vorm', label: 'Vorm oefenen', short: 'vorm' },
];

export function viewVerantwoording({ signal } = {}) {
  document.title = 'Verantwoording · Svenska övningar';
  const body = h('div', { class: 'vw-body' }, h('p', { class: 'muted' }, 'Gegevens laden …'));
  import('virtual:verantwoording')
    .then(({ default: data }) => {
      if (!signal?.aborted) fill(body, content(data));
    })
    .catch(() => {
      if (!signal?.aborted) fill(body, h('p', {}, 'De gegevens konden niet worden geladen. Probeer het later opnieuw.'));
    });
  return h('div', { class: 'prose verantwoording' },
    crumbs({ label: 'Start', href: '#/' }, { label: 'Over deze site', href: '#/over' }, { label: 'Verantwoording' }),
    h('h1', {}, 'Verantwoording'),
    h('p', { class: 'lead' }, 'Hoe de oefenstof is opgebouwd, en waarom zo. De cijfers worden bij elke nieuwe versie van de site automatisch berekend uit de oefeningen zelf.'),
    body,
  );
}

// ---------- inhoud ----------

function content(d) {
  const t = d.totals;
  const chs = d.chapters.filter((c) => c.qs);
  const lineOf = (c) => d.line.find((l) => c.ch >= l.from && c.ch <= l.to) ?? null;
  return [
    tiles([
      [nf(t.chapters), 'hoofdstukken'],
      [nf(t.questions), 'vragen'],
      [nf(t.vocab), 'woorden in de woordenlijsten'],
      [nf(t.cards), 'uitlegkaarten'],
      [nf(t.texts), 'leesteksten'],
      [nf(t.canDo), 'kan-doen-doelen'],
    ]),
    d.beforeMissing ? h('p', { class: 'note' }, 'Let op: deze versie is gebouwd zonder de A1–A2-site. Woorden uit die hoofdstukken tellen daardoor niet als bekend, en de dekking van teksten valt lager uit dan in werkelijkheid.') : null,
    attentionBlock(d),

    h('h2', { id: 'uitgangspunten' }, 'Tien uitgangspunten'),
    h('p', {}, 'Elke oefening en elke functie moet in deze lijn passen. Wat te meten is, controleert de site bij elke wijziging automatisch; de rest wordt nagekeken in een taalreview en een code-review.'),
    h('ol', { class: 'vw-principles' },
      principle('Vier soorten oefenen in balans', 'Naast vorm oefenen ook lezen en luisteren voor de betekenis, zelf iets zeggen of schrijven, en vlot worden (snelle rondes).', '#strands'),
      principle('Ophalen en spreiden', 'Elke nagekeken vraag komt terug in de dagelijkse herhaling, steeds later als je hem goed hebt (2, 4, 7, 14 … dagen).', null),
      principle('Feedback in lagen', 'Eerst een tip over je fout, dan de regel met een link naar de uitleg, pas daarna het antwoord.', '#feedback'),
      principle('De app kijkt na', 'Je hoeft jezelf nergens te beoordelen. Wat de app niet kan nakijken, is oefenen zonder oordeel.', null),
      principle('Van vorm naar gebruik', 'Per onderwerp eerst herkennen en maken, dan kiezen en mengen, en tot slot gebruiken in een tekst, situatie of schrijfopdracht.', '#strands'),
      principle('Kan-doen-doelen beloven wat de app meet', 'Een doel wordt pas afgevinkt als de vragen erover grotendeels stevig in de herhaling zitten.', '#grammatica'),
      principle('Instap op niveau', 'Met de instaptoets per hoofdstuk zet je wat je al kunt meteen hoger in de herhaling.', null),
      principle('Uitspraak horen', 'Alles kan worden voorgelezen door de stem van je apparaat. Spreken wordt niet nagekeken.', null),
      principle('Frequente woorden per thema', 'Elk hoofdstuk heeft een thema, met de woorden die je het vaakst nodig hebt, en die woorden komen in de oefeningen en later terug.', '#woorden'),
      principle('Eigen werk', 'Alle zinnen, teksten en uitleg zijn zelf geschreven en door een taalreview gegaan. Er is niets overgenomen uit een lesmethode.', null),
    ),

    h('h2', { id: 'strands' }, 'Soorten oefenen'),
    h('p', {}, 'Taalonderzoeker Paul Nation verdeelt goed taalonderwijs in vier gelijke delen: lezen en luisteren voor de betekenis, zelf iets zeggen of schrijven, gericht oefenen met vormen, en vlot worden. Vlot worden zit in de app (snelle rondes en de vloeiendheidsronde); de andere drie zijn per vraag te tellen.'),
    legend(STRANDS.map((s) => [`vw-s-${s.key}`, s.label])),
    figure('Alle hoofdstukken samen', stackBar(STRANDS.map((s) => ({ cls: `vw-s-${s.key}`, n: t.strands[s.key], label: s.label })), t.questions)),
    figure('Per hoofdstuk', rows(chs, (c) => stackBar(STRANDS.map((s) => ({ cls: `vw-s-${s.key}`, n: c.strands[s.key], label: s.label })), c.qs))),
    h('p', { class: 'muted small' }, 'Vorm oefenen is het grootste deel: invullen, kiezen, omvormen, zinnen bouwen en vertalen. Wat je daarmee leert, gebruik je in de teksten, situaties en schrijfopdrachten. Elke vraag wordt bij één soort geteld; een schrijfopdracht met een tekst telt bijvoorbeeld als zelf schrijven.'),
    table(['H', ...STRANDS.map((s) => s.label), 'vragen'], chs.map((c) => [c.ch, ...STRANDS.map((s) => `${pct(c.strands[s.key], c.qs)}%`), c.qs])),

    h('h2', { id: 'moeilijkheid' }, 'Moeilijkheid'),
    h('p', {}, 'De stof wordt per hoofdstuk iets moeilijker. Per niveau is er een doel voor de lengte van de zinnen die je zelf maakt en van de leestekst. Het gekleurde vak is het doel voor dat niveau, de stip is het hoofdstuk.'),
    figure('Lengte van je antwoord (woorden per zin, gemiddeld)', rangeRows(chs, (c) => c.answer, (l) => l.answer, 1, lineOf)),
    figure('Lengte van de leestekst (woorden)', rangeRows(chs.filter((c) => c.text), (c) => c.text, (l) => l.text, 0, lineOf)),
    h('p', { class: 'muted small' }, 'Binnen een hoofdstuk loopt het op; oudere stof komt in de herhaling terug op het niveau van toen. Het doel is een eigen richtlijn, geen officiële norm.'),
    table(['H', 'niveau', 'vragen', 'antwoord (woorden)', 'leestekst (woorden)', 'zelf maken'],
      chs.map((c) => [c.ch, c.level ?? '–', c.questions, nf(c.answer, 1), c.text || '–', `${Math.round(c.produceShare * 100)}%`])),

    h('h2', { id: 'woorden' }, 'Woordenschat'),
    h('p', {}, 'Een woord dat je alleen in een lijst ziet, onthoud je slecht. Elk woord uit de woordenlijst oefen je in de woordenoefeningen van het hoofdstuk en daarna in de dagelijkse herhaling. Daarnaast is het doel dat zoveel mogelijk woorden ook in een zin of tekst van het hoofdstuk staan, en dat ze later terugkomen, zodat je ze op verschillende momenten in een andere context tegenkomt. Hier valt in een aantal hoofdstukken nog winst te halen.'),
    legend([['vw-c1', 'gebruikt in een zin of tekst van het hoofdstuk'], ['vw-c2', 'komt in een later hoofdstuk terug']]),
    figure('Per hoofdstuk, als deel van de woordenlijst', rows(chs.filter((c) => c.vocab), (c) => pairBars([
      { cls: 'vw-c1', p: pct(c.used, c.vocab), label: 'gebruikt in een zin of tekst' },
      { cls: 'vw-c2', p: pct(c.recur, c.vocab), label: 'komt later terug' },
    ]))),
    h('p', { class: 'muted small' }, 'Het laatste hoofdstuk heeft vanzelf weinig woorden die later terugkomen. Vormen worden herkend zonder woordenboek (meervoud, bepaalde vorm, vervoegingen); een onregelmatige vorm wordt soms gemist.'),
    table(['H', 'woorden', 'in een zin of tekst', 'later terug'], chs.filter((c) => c.vocab).map((c) => [c.ch, c.vocab, `${pct(c.used, c.vocab)}%`, `${pct(c.recur, c.vocab)}%`])),

    h('h2', { id: 'teksten' }, 'Makkelijk lezen'),
    h('p', {}, `Naast de leestekst heeft elk hoofdstuk minstens vier makkelijke teksten. Daarin ken je bijna alle woorden al, zodat je vlot kunt lezen en op de inhoud kunt letten. Het doel is minstens ${Math.round(d.th.easyKnown * 100)}% bekende woorden. Elke stip is een tekst.`),
    figure('Bekende woorden per makkelijke tekst', easyRows(chs, d.th.easyKnown)),
    table(['H', 'teksten', 'bekende woorden'], chs.filter((c) => c.texts.some((x) => x.easy)).map((c) => [c.ch, c.texts.filter((x) => x.easy).length, c.texts.filter((x) => x.easy).map((x) => `${Math.round(x.known * 100)}%`).join(' · ')])),

    h('h2', { id: 'feedback' }, 'Feedback bij fouten'),
    h('p', {}, `Maak je zelf een zin of vorm, dan herkent de app veelgemaakte fouten en geeft hij een gerichte tip (bijvoorbeeld over de woordvolgorde). Het doel: bij minstens de helft van die vragen een eigen tip. Bij de rest helpen de algemene tips over uitgangen, puntjes op de å, ä en ö, en woordvolgorde.`),
    figure('Zelf-maakvragen met een eigen tip', rows(chs, (c) => pctBar(pct(c.feedback, c.produce), d.th.feedback * 100, `${c.feedback} van ${c.produce}`))),
    table(['H', 'zelf-maakvragen', 'met eigen tip'], chs.map((c) => [c.ch, c.produce, `${c.feedback} (${pct(c.feedback, c.produce)}%)`])),

    h('h2', { id: 'grammatica' }, 'Grammatica en kan-doen-doelen'),
    h('p', {}, `Elke uitlegkaart heeft vragen in het eigen hoofdstuk (richtlijn: minstens ${d.th.cardMin}), en het onderwerp komt later terug in nieuwe zinnen. Een kan-doen-doel telt de vragen over zijn onderwerpen; het vinkje komt pas als je die grotendeels beheerst.`),
    chs.map((c) => (c.cards.length || c.canDo.length) && h('details', { class: 'vw-ch' },
      h('summary', {}, `Hoofdstuk ${c.ch}`, h('span', { class: 'muted' }, ` · ${c.cards.length} kaarten, ${c.canDo.length} doelen`)),
      c.cards.length ? h('table', { class: 'vw-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'uitlegkaart'), h('th', {}, 'vragen'), h('th', {}, 'later terug'))),
        h('tbody', {}, c.cards.map((g) => h('tr', {}, h('td', {}, g.title), h('td', {}, g.here), h('td', {}, g.after))))) : null,
      c.canDo.length ? h('ul', { class: 'vw-cando' }, c.canDo.map((x) => h('li', {}, x.text, h('span', { class: 'muted' }, ` · ${x.n} vragen`)))) : null,
    )),

    h('h2', { id: 'grenzen' }, 'Wat deze cijfers niet zeggen'),
    h('ul', {},
      h('li', {}, 'Het zijn tellingen zonder woordenboek: benaderingen, geen oordeel over de kwaliteit van een zin.'),
      h('li', {}, 'Ze zeggen niets over hoe goed het leren werkt. Dat blijkt pas uit anonieme tellingen na publicatie: welke vragen vaak fout gaan en hoeveel stof stevig in de herhaling komt.'),
      h('li', {}, 'De doelen voor lengte en aantal zijn een eigen richtlijn. De grens tussen A1 en A2 bij hoofdstuk 6 en 7 is een aanname.'),
    ),
  ];
}

function attentionBlock(d) {
  const a = d.attention;
  if (!a.length) {
    return h('p', { class: 'vw-status vw-ok' }, h('span', { 'aria-hidden': 'true' }, '✓ '), 'Geen aandachtspunten: alle hoofdstukken zitten op of boven de richtlijnen hieronder.');
  }
  return h('div', { class: 'vw-status vw-warn' },
    h('p', {}, h('span', { 'aria-hidden': 'true' }, '! '), `${a.length} ${a.length === 1 ? 'aandachtspunt' : 'aandachtspunten'}: hier zit een hoofdstuk onder een richtlijn.`),
    h('ul', {}, a.map((f) => h('li', {}, h('strong', {}, `H${f.chapter}: `), f.text))));
}

// ---------- bouwstenen ----------

const principle = (title, text, href) => h('li', {}, h('strong', {}, title), '. ', text, href ? [' ', h('a', { href: `#/verantwoording`, 'data-anchor': href.slice(1), onclick: jump }, 'Bekijk')] : null);

/** In-pagina-link zonder de hash-router te storen. */
function jump(e) {
  e.preventDefault();
  document.getElementById(e.currentTarget.dataset.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function tiles(list) {
  return h('div', { class: 'stat-tiles' }, list.map(([n, label]) => h('div', { class: 'stat-tile' }, h('strong', {}, n), h('span', { class: 'muted' }, label))));
}

function legend(items) {
  return h('ul', { class: 'vw-legend' }, items.map(([cls, label]) => h('li', {}, h('span', { class: `vw-key ${cls}`, 'aria-hidden': 'true' }), label)));
}

function figure(title, chart) {
  return h('figure', { class: 'vw-fig' }, h('figcaption', {}, title), chart);
}

/** Eén rij per hoofdstuk: label links, grafiek rechts. */
function rows(chs, draw) {
  return h('div', { class: 'vw-rows' }, chs.map((c) => h('div', { class: 'vw-row' }, h('span', { class: 'vw-label' }, `H${c.ch}`), draw(c))));
}

/** Gestapelde balk met delen; label in het deel als het breed genoeg is. */
function stackBar(parts, total) {
  return h('div', { class: 'vw-bar vw-stack', role: 'img', 'aria-label': parts.map((p) => `${p.label} ${pct(p.n, total)}%`).join(', ') },
    parts.filter((p) => p.n).map((p) => {
      const w = pct(p.n, total);
      return h('span', { class: `vw-seg ${p.cls}`, style: `flex-grow: ${p.n}`, title: `${p.label}: ${w}% (${p.n} vragen)` }, w >= 12 ? `${w}%` : '');
    }));
}

/** Twee dunne balken onder elkaar, elk met hun percentage. */
function pairBars(parts) {
  return h('div', { class: 'vw-pair' }, parts.map((p) => h('div', { class: 'vw-pair-row' },
    h('div', { class: 'vw-track', title: `${p.label}: ${p.p}%` }, h('span', { class: `vw-fill ${p.cls}`, style: `width: ${p.p}%` })),
    h('span', { class: 'vw-val' }, `${p.p}%`))));
}

/** Percentagebalk met een streep bij het doel. */
function pctBar(p, target, detail) {
  return h('div', { class: 'vw-pair-row' },
    h('div', { class: 'vw-track', title: `${p}% (${detail})` },
      h('span', { class: `vw-fill ${p >= target ? 'vw-c1' : 'vw-low'}`, style: `width: ${p}%` }),
      h('span', { class: 'vw-target', style: `left: ${target}%`, title: `doel: ${target}%` })),
    h('span', { class: 'vw-val' }, `${p}%`, p < target ? h('span', { class: 'vw-flag' }, ' !') : null));
}

/** Stip per hoofdstuk op een as, met het doelvak van zijn niveau. */
function rangeRows(chs, value, band, digits, lineOf) {
  const all = chs.flatMap((c) => [value(c), ...(lineOf(c) ? band(lineOf(c)) : [])]);
  const min = Math.max(0, Math.floor(Math.min(...all) * 0.8));
  const max = Math.ceil(Math.max(...all) * 1.1);
  const at = (x) => `${Math.max(0, Math.min(100, ((x - min) / (max - min)) * 100))}%`;
  return h('div', {}, h('div', { class: 'vw-rows' }, chs.map((c) => {
    const l = lineOf(c);
    const [lo, hi] = l ? band(l) : [null, null];
    const v = value(c);
    const off = l && (v < lo || v > hi + (digits ? 2 : hi * 0.2));
    return h('div', { class: 'vw-row' }, h('span', { class: 'vw-label' }, `H${c.ch}`),
      h('div', { class: 'vw-pair-row' },
        h('div', { class: 'vw-track vw-axis', title: l ? `${nf(v, digits)} (doel ${c.level}: ${lo}–${hi})` : nf(v, digits) },
          l ? h('span', { class: 'vw-band', style: `left: ${at(lo)}; width: calc(${at(hi)} - ${at(lo)})` }) : null,
          h('span', { class: `vw-dot ${off ? 'vw-dot-off' : ''}`, style: `left: ${at(v)}` })),
        h('span', { class: 'vw-val' }, nf(v, digits))));
  })), h('div', { class: 'vw-row vw-scale', 'aria-hidden': 'true' }, h('span', { class: 'vw-label' }),
    h('div', { class: 'vw-pair-row' }, h('div', { class: 'vw-ticks' }, h('span', {}, nf(min)), h('span', {}, nf((min + max) / 2, (min + max) % 2 ? 1 : 0)), h('span', {}, nf(max))), h('span', {}))));
}

/** Stippen per makkelijke tekst op een as van 80 tot 100%, met een streep bij het doel. */
function easyRows(chs, goal) {
  const lo = 80;
  const at = (k) => `${Math.max(0, ((k * 100 - lo) / (100 - lo)) * 100)}%`;
  return h('div', {},
    h('div', { class: 'vw-rows' }, chs.filter((c) => c.texts.some((x) => x.easy)).map((c) => h('div', { class: 'vw-row' },
      h('span', { class: 'vw-label' }, `H${c.ch}`),
      h('div', { class: 'vw-track vw-axis' },
        h('span', { class: 'vw-target', style: `left: ${at(goal)}`, title: `doel: ${Math.round(goal * 100)}%` }),
        c.texts.filter((x) => x.easy).map((x) => h('span', { class: `vw-dot ${x.known < goal ? 'vw-dot-off' : ''}`, style: `left: ${at(x.known)}`, title: `${Math.round(x.known * 100)}% bekend, ${x.words} woorden` })))))),
    h('div', { class: 'vw-row vw-scale', 'aria-hidden': 'true' }, h('span', { class: 'vw-label' }),
      h('div', { class: 'vw-ticks' }, h('span', {}, `${lo}%`), h('span', {}, '90%'), h('span', {}, '100%'))));
}

function table(head, body) {
  return h('details', { class: 'vw-tablewrap' }, h('summary', {}, 'Als tabel'),
    h('div', { class: 'vw-scroll' }, h('table', { class: 'vw-table' },
      h('thead', {}, h('tr', {}, head.map((x) => h('th', {}, x)))),
      h('tbody', {}, body.map((r) => h('tr', {}, r.map((x) => h('td', {}, x))))))));
}

