// Over deze site: handleiding, uitleg, privacy, app en steun. Instellingen en voortgang hebben een eigen pagina.
import { h } from '../dom.js';
import { SITE_TEXT, SIBLING } from '../../config.js';
import { reportConfigured, feedbackButton } from '../components/report.js';
import { installSection } from '../components/pwa.js';
import { analyticsConfigured } from '../../platform/analytics.js';
import { crumbs } from '../shared.js';
import { KOFI_URL, MONTHLY_TEXT } from '../components/support.js';

export function viewAbout() {
  document.title = 'Over · Svenska övningar';
  return h('div', { class: 'prose about' },
    crumbs({ label: 'Start', href: '#/' }, { label: 'Over deze site' }),
    h('h1', {}, 'Over deze site'),
    h('p', {}, SITE_TEXT.about),
    h('h2', {}, 'Handleiding: zo begin je'),
    h('ol', {},
      h('li', {}, 'Kies op de startpagina een hoofdstuk. Elk hoofdstuk heeft uitleg (grammatica), oefeningen, woorden en een toets.'),
      h('li', {}, 'Lees eerst de uitleg of begin direct met de eerste oefening. Bij elke vraag staat een link naar de uitleg die erbij hoort.'),
      h('li', {}, 'Maak de oefeningen van boven naar beneden. Lange woordenlijsten oefen je in rondes van 10 woorden: eerst nieuwe en foute woorden.'),
      h('li', {}, 'Kom elke dag even terug: de dagelijkse herhaling op de startpagina zet klaar wat je weer moet oefenen.'),
      h('li', {}, 'Op je telefoon? Zet de site als app op je beginscherm (zie „Als app installeren” hieronder).'),
    ),
    h('p', {}, SIBLING.about[0], h('a', { href: SIBLING.href }, SIBLING.about[1]), SIBLING.about[2]),
    h('h2', {}, 'Luisteren'),
    h('p', {}, 'De site leest Zweeds voor met de spraakfunctie van je eigen browser. Hoe goed dat klinkt, hangt af van de Zweedse stemmen op je apparaat. ', h('a', { href: '#/luisteren' }, 'Luisteren instellen'), ' legt per browser uit hoe je een goede stem krijgt.'),
    h('p', {}, 'Alle oefenzinnen, teksten en uitleg op deze site zijn zelf geschreven. De site is niet verbonden aan een uitgever of lesmethode.'),
    h('h2', {}, 'Hoe werkt het nakijken?'),
    h('ul', {},
      h('li', {}, 'Hoofdletters, leestekens en extra spaties tellen niet mee.'),
      h('li', {}, 'Bij een fout krijg je eerst een tip, bijvoorbeeld over de woordvolgorde, een uitgang of de puntjes op de å, ä en ö.'),
      h('li', {}, 'Na een tweede fout zie je de regel met een link naar de uitleg. Na drie pogingen kun je het antwoord laten zien.'),
      h('li', {}, 'Bij een schrijfopdracht controleert de site alleen een paar dingen en krijg je een voorbeeldantwoord om mee te vergelijken.'),
    ),
    h('h2', {}, 'Snel werken'),
    h('ul', {},
      h('li', {}, 'Meerkeuze, keuzelijsten en koppelen worden meteen nagekeken zodra je antwoord compleet is.'),
      h('li', {}, 'Bij woordtegels druk je zelf op Controleer, zodat je eerst nog kunt schuiven. Tik tussen twee woorden in je zin om daar een woord in te voegen; tik op een woord in je zin om het weg te halen.'),
      h('li', {}, 'Typ je antwoord en druk op Enter. Bij meerkeuze kun je de cijfertoetsen 1–9 gebruiken.'),
      h('li', {}, 'Na een goed antwoord ga je vanzelf door naar de volgende vraag. Op een telefoon wacht de site even; tik of scrol je intussen, dan blijf je staan en tik je zelf op „Volgende vraag”. Dit kun je uitzetten bij Instellingen. Aan het eind brengt Enter je naar de volgende oefening.'),
    ),
    h('h2', {}, 'Oefenvormen'),
    h('ul', {},
      h('li', {}, 'Dagelijkse herhaling: wat je in één keer goed hebt, komt steeds later terug (na 2, 4, 7, 14 … dagen). Wat je fout had, komt de volgende dag terug. Elke dag staan er hooguit 20 vragen klaar; wie meer wil, kan doorgaan.'),
      h('li', {}, 'Werkwoordtrainer: eindeloos werkwoordsvormen oefenen, met de tijden en soorten werkwoorden die jij kiest.'),
      h('li', {}, 'Zoek de fout: klik op het foute woord en verbeter de zin.'),
      h('li', {}, 'Toets: twintig vragen per hoofdstuk zonder tips, met een rapport per onderwerp.'),
      h('li', {}, 'Flitskaarten: bij elk woord de goede betekenis kiezen; de app kijkt na.'),
      h('li', {}, 'Snelle rondes: zoveel mogelijk goede antwoorden in 60 seconden.'),
    ),
    reportConfigured() ? [
      h('h2', {}, 'Een fout of probleem melden'),
      h('p', {}, 'Klopt er iets niet in een vraag, of wordt een goed antwoord fout gerekend? Klik bij de vraag op „Fout gezien?” en schrijf kort wat er mis is. De vraag en je antwoord worden automatisch meegestuurd. Je hebt geen account nodig. Je melding wordt een openbaar issue op GitHub, dus zet er geen persoonlijke gegevens in. Tegen spam controleert Cloudflare Turnstile of je een mens bent.'),
      h('p', {}, 'Gaat er iets anders mis in de app, is iets onduidelijk, of heb je een idee? Gebruik dan deze knop.'),
      h('div', { class: 'actions' }, feedbackButton()),
    ] : null,
    h('h2', {}, 'Verantwoording'),
    h('p', {}, 'Hoe is de oefenstof opgebouwd, en waarom zo? ', h('a', { href: '#/verantwoording' }, 'De verantwoording'), ' laat met cijfers en grafieken zien hoe de site oefenen in balans houdt, hoe de moeilijkheid oploopt, en hoe woorden en grammatica terugkomen.'),
    h('h2', {}, 'Instellingen en voortgang'),
    h('p', {}, 'Stem, thema, woordtegels of typen, de knoppen voor å, ä en ö en vanzelf doorgaan stel je in bij ', h('a', { href: '#/instellingen' }, 'Instellingen'), '. Je statistieken, prestaties, synchroniseren tussen apparaten en exporteren vind je bij ', h('a', { href: '#/voortgang' }, 'Voortgang'), '.'),
    h('h2', {}, 'Privacy en statistieken'),
    analyticsConfigured()
      ? h('p', {}, 'Om de site te verbeteren tellen we anoniem mee welke pagina\'s bezocht worden en welke vragen vaak goed of fout gaan. Daarvoor gebruiken we GoatCounter: zonder cookies, zonder persoonsgegevens en zonder je antwoorden zelf. Meetellen zet je uit bij ', h('a', { href: '#/instellingen' }, 'Instellingen'), '.')
      : h('p', {}, 'Deze site verzamelt geen statistieken.'),
    installSection(),
    h('h2', {}, 'Steun deze site'),
    h('p', {}, 'Deze site is gratis en zonder reclame, en dat blijft zo. Heb je er iets aan en wil je iets terugdoen? Een kleine bijdrage via Ko-fi helpt om de site te onderhouden en uit te breiden.'),
    h('div', { class: 'actions' },
      h('a', { class: 'btn primary', href: KOFI_URL, target: '_blank', rel: 'noopener' }, 'Steun via Ko-fi ☕')),
    h('p', { class: 'muted' }, MONTHLY_TEXT),
    h('p', { class: 'muted version' },`Versie ${import.meta.env.APP_VERSION ?? 'onbekend'}`),
  );
}

