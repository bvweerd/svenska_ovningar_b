// Plaatjes voor de prestaties: één Zweeds motief per badgegroep, de rand geeft het niveau.
// Inline SVG (geen bestanden): werkt offline en is in beide sites gelijk.
// Niveau (badge.tier): 0 = losse badge (blauw-geel), 1 brons, 2 zilver, 3 goud, 4 vlagrand.

const BLUE = '#006AA7';
const YELLOW = '#FECC02';
const FALU = '#A3282B';
const WHITE = '#FFFFFF';
const INK = '#1D2330';
const GREEN = '#2E7D32';
const WOOD = '#B5793A';

const crown = (x, y) => `<g transform="translate(${x} ${y})"><path d="M0 11 L0 3 L3.75 6.5 L7.5 0 L11.25 6.5 L15 3 L15 11 Z" fill="${YELLOW}" stroke="#B88A00" stroke-width="0.8" stroke-linejoin="round"/><rect x="0" y="11" width="15" height="2.6" fill="${YELLOW}" stroke="#B88A00" stroke-width="0.8"/><circle cx="7.5" cy="0" r="1.1" fill="${YELLOW}" stroke="#B88A00" stroke-width="0.6"/></g>`;

const ski = (angle) => `<g transform="rotate(${angle} 32 32)"><path d="M29.5 50 L29.5 17 Q29.5 11 32 10 Q34.5 11 34.5 17 L34.5 50 Z" fill="${FALU}" stroke="#6E181B" stroke-width="0.7"/><rect x="29.5" y="30" width="5" height="4" fill="${BLUE}"/><rect x="29.5" y="31.4" width="5" height="1.2" fill="${YELLOW}"/></g>`;

/** Motief per badgegroep (id's uit core/rewards/badges.js). */
const MOTIFS = {
  // Oefeningen afronden: dalahäst
  oefening: `
<path d="M15 23 L20 19 L22 14 L24.5 18 L27 21 L28 26 L44 26 L47 24 L49 29 L46 31 L46 46 L40 46 L39 38 L29 38 L28 46 L22 46 L22 33 L20 28 L15 28 Z" fill="${FALU}" stroke="#7A1C1F" stroke-width="0.8" stroke-linejoin="round"/>
<path d="M29 26 Q35 35 41 26 Z" fill="${BLUE}" stroke="${WHITE}" stroke-width="1"/>
<path d="M31 27.5 Q35 32 39 27.5" fill="none" stroke="${YELLOW}" stroke-width="1"/>
<path d="M20.5 19.5 L23 27 M16 25 L22 25.5" fill="none" stroke="${WHITE}" stroke-width="1.1" stroke-linecap="round"/>
<circle cx="19.5" cy="22.3" r="1" fill="${WHITE}"/>
<path d="M24 31 q2 -2 4 0 M43 30 q1.5 -1.5 3 0" fill="none" stroke="${WHITE}" stroke-width="1" stroke-linecap="round"/>
<circle cx="26" cy="34" r="1.1" fill="${YELLOW}"/><circle cx="43" cy="34" r="1.1" fill="${YELLOW}"/>`,

  // Kan-doen-doelen: midsommarstång
  doelen: `
<ellipse cx="32" cy="49" rx="15" ry="3" fill="#7CB342"/>
<rect x="30.8" y="13" width="2.4" height="36" rx="1" fill="${GREEN}"/>
<rect x="19" y="21" width="26" height="2.4" rx="1" fill="${GREEN}"/>
<path d="M33.2 13 L41 15.5 L33.2 18 Z" fill="${BLUE}"/><path d="M33.2 15 L39 15.5 L33.2 16.2 Z" fill="${YELLOW}"/>
<circle cx="21" cy="29" r="5" fill="none" stroke="${GREEN}" stroke-width="2.6"/>
<circle cx="43" cy="29" r="5" fill="none" stroke="${GREEN}" stroke-width="2.6"/>
<path d="M21 23.4 V24 M43 23.4 V24" stroke="${GREEN}" stroke-width="1.5"/>
<g fill="${YELLOW}"><circle cx="17" cy="27" r="1.2"/><circle cx="24.5" cy="32.5" r="1.2"/><circle cx="46.5" cy="26.5" r="1.2"/><circle cx="40" cy="33" r="1.2"/></g>
<g fill="${WHITE}" stroke="#C2185B" stroke-width="0.5"><circle cx="20" cy="34" r="1.1"/><circle cx="44.5" cy="33.5" r="1.1"/><circle cx="32" cy="30" r="1.2"/></g>
<path d="M32 24 Q27 36 25 42 M32 24 Q37 36 39 42" fill="none" stroke="${BLUE}" stroke-width="1.2"/>
<path d="M32 24 Q29 36 28.5 43 M32 24 Q35 36 35.5 43" fill="none" stroke="${YELLOW}" stroke-width="1.2"/>`,

  // Hoofdstukken: rood huisje met witte hoeken
  hoofdstuk: `
<ellipse cx="32" cy="47" rx="19" ry="3" fill="#7CB342"/>
<rect x="39" y="18" width="3.4" height="8" fill="#3A3A3A"/>
<rect x="18" y="30" width="28" height="17" fill="${FALU}"/>
<path d="M14.5 31.5 L32 17.5 L49.5 31.5 Z" fill="#3A3A3A"/>
<path d="M15.5 31.5 L32 18.5 L48.5 31.5" fill="none" stroke="${WHITE}" stroke-width="1.6" stroke-linejoin="round"/>
<rect x="18" y="31" width="1.8" height="16" fill="${WHITE}"/><rect x="44.2" y="31" width="1.8" height="16" fill="${WHITE}"/>
<rect x="22.5" y="36" width="6.5" height="11" fill="${BLUE}" stroke="${WHITE}" stroke-width="1.2"/>
<circle cx="27.4" cy="42" r="0.6" fill="${YELLOW}"/>
<rect x="33" y="34" width="8.5" height="7.5" fill="${YELLOW}" stroke="${WHITE}" stroke-width="1.4"/>
<path d="M37.25 34 V41.5 M33 37.75 H41.5" stroke="${WHITE}" stroke-width="1"/>`,

  // Beheerst (geheugen): eland
  beheerst: `
<path d="M27.5 25 Q22 24 18.5 18 L17 12.5 L20 15.5 L20.5 11 L22.8 15.5 L24.5 10.5 L25.8 16 L28 12.5 L28.5 21 Z" fill="#D9B77E" stroke="#8A6A3A" stroke-width="0.7" stroke-linejoin="round"/>
<path d="M36.5 25 Q42 24 45.5 18 L47 12.5 L44 15.5 L43.5 11 L41.2 15.5 L39.5 10.5 L38.2 16 L36 12.5 L35.5 21 Z" fill="#D9B77E" stroke="#8A6A3A" stroke-width="0.7" stroke-linejoin="round"/>
<ellipse cx="23.5" cy="28.5" rx="4.5" ry="2.2" transform="rotate(-25 23.5 28.5)" fill="#5A3A1E"/>
<ellipse cx="40.5" cy="28.5" rx="4.5" ry="2.2" transform="rotate(25 40.5 28.5)" fill="#5A3A1E"/>
<path d="M26.5 25.5 Q32 21.5 37.5 25.5 L38.5 38 Q39 47 32 47 Q25 47 25.5 38 Z" fill="#6B4423"/>
<path d="M27 39 Q32 36.5 37 39 Q38 46.5 32 46.5 Q26 46.5 27 39 Z" fill="#7E5530"/>
<circle cx="29" cy="31" r="1.4" fill="${INK}"/><circle cx="35" cy="31" r="1.4" fill="${INK}"/>
<circle cx="29.4" cy="30.6" r="0.4" fill="${WHITE}"/><circle cx="35.4" cy="30.6" r="0.4" fill="${WHITE}"/>
<ellipse cx="29.8" cy="43" rx="1" ry="1.4" fill="#3A2412"/><ellipse cx="34.2" cy="43" rx="1" ry="1.4" fill="#3A2412"/>`,

  // Toetsen gehaald: studentmössa
  toets: `
<path d="M16.5 25 L19 35 L45 35 L47.5 25 Z" fill="${WHITE}" stroke="#B9BEC7" stroke-width="0.8"/>
<ellipse cx="32" cy="24.5" rx="16" ry="6.5" fill="${WHITE}" stroke="#B9BEC7" stroke-width="0.8"/>
<path d="M19 31.5 L45 31.5 L45 37 L19 37 Z" fill="${INK}"/>
<path d="M20 37 Q32 46.5 44 37 Z" fill="#0E1118"/>
<circle cx="32" cy="33" r="3.6" fill="${YELLOW}" stroke="${BLUE}" stroke-width="1.8"/>
<circle cx="32" cy="33" r="1" fill="${BLUE}"/>
<path d="M30 22 L32 19.5 L34 22" fill="none" stroke="${YELLOW}" stroke-width="1"/>`,

  // Foutloze toets: Tre Kronor
  foutloos: crown(15, 15) + crown(34, 15) + crown(24.5, 33),

  // Oefendagen: fika (koffie en kanelbulle)
  dagen: `
<ellipse cx="27" cy="44" rx="14" ry="3.2" fill="${WHITE}" stroke="#9AA1AD" stroke-width="0.8"/>
<path d="M36.5 33 a4 4 0 1 1 -1 7" fill="none" stroke="#9AA1AD" stroke-width="2"/>
<path d="M16 30 L38 30 L36 41.5 Q27 45 18 41.5 Z" fill="${WHITE}" stroke="#9AA1AD" stroke-width="0.8"/>
<path d="M18.5 35 L35.5 35" stroke="${BLUE}" stroke-width="1.6"/>
<ellipse cx="27" cy="30" rx="11" ry="2.3" fill="#6B3E1F"/>
<path d="M23 26 q-2 -3 0 -6 q2 -3 0 -6 M30 26 q-2 -3 0 -6 q2 -3 0 -6" fill="none" stroke="#9AA1AD" stroke-width="1.1" stroke-linecap="round"/>
<circle cx="44" cy="40" r="7.5" fill="#C8833D" stroke="#8A5320" stroke-width="0.8"/>
<path d="M44 40 a1.6 1.6 0 1 1 1.6 1.6 a3.2 3.2 0 1 1 -3.2 -3.2 a4.8 4.8 0 1 1 4.8 4.8" fill="none" stroke="#7A4A1E" stroke-width="1.1" stroke-linecap="round"/>
<g fill="${WHITE}"><circle cx="41" cy="36" r="0.8"/><circle cx="47.5" cy="37.5" r="0.8"/><circle cx="40.5" cy="43" r="0.8"/><circle cx="46" cy="44.5" r="0.8"/><circle cx="44.5" cy="35" r="0.7"/></g>`,

  // Dictee (luisteren): nyckelharpa
  dictee: `
<g transform="rotate(-32 32 32)">
<rect x="9" y="30.2" width="5.5" height="3.6" rx="1.4" fill="#7A4A1E"/>
<circle cx="9.5" cy="32" r="2.4" fill="#7A4A1E"/>
<rect x="13.5" y="29" width="22" height="6" rx="1" fill="#C68B4E" stroke="#7A4A1E" stroke-width="0.7"/>
<path d="M34 32 C34 24 42 23 45 26.5 C48 23.5 54.5 26 54.5 32 C54.5 38 48 40.5 45 37.5 C42 41 34 40 34 32 Z" fill="${WOOD}" stroke="#7A4A1E" stroke-width="0.8"/>
<g fill="${WHITE}" stroke="#7A4A1E" stroke-width="0.4"><rect x="16" y="34.5" width="1.6" height="4"/><rect x="19.5" y="34.5" width="1.6" height="4.6"/><rect x="23" y="34.5" width="1.6" height="4"/><rect x="26.5" y="34.5" width="1.6" height="4.6"/><rect x="30" y="34.5" width="1.6" height="4"/></g>
<path d="M12 30.8 H50 M12 32 H50 M12 33.2 H50" stroke="#F3E6CF" stroke-width="0.45"/>
<rect x="49.5" y="29.3" width="1.4" height="5.4" fill="#5A3412"/>
<path d="M40 29 q-1.5 3 0 6 M50 29 q1.5 3 0 6" fill="none" stroke="#5A3412" stroke-width="0.9"/>
</g>
<path d="M22 50 L49 20" stroke="#5A5F6A" stroke-width="1.4" stroke-linecap="round"/>
<path d="M15.5 17 v-5 l4 -1 v5" fill="none" stroke="${BLUE}" stroke-width="1.2"/><circle cx="14.5" cy="17" r="1.3" fill="${BLUE}"/><circle cx="18.5" cy="16" r="1.3" fill="${BLUE}"/>`,

  // Snelle ronde: ski's van de Vasaloppet
  snel: `
<path d="M12 22 H23 M10 28 H20 M13 34 H21" stroke="${YELLOW}" stroke-width="2" stroke-linecap="round"/>
<path d="M22 13 L42 51 M42 13 L22 51" stroke="#5A5F6A" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="40" cy="47" r="2.4" fill="none" stroke="#5A5F6A" stroke-width="1.2"/><circle cx="24" cy="47" r="2.4" fill="none" stroke="#5A5F6A" stroke-width="1.2"/>
${ski(28)}${ski(-28)}`,
};

/** Rand per niveau: [buitenrand, binnenrand]. */
const RINGS = {
  0: [BLUE, YELLOW],
  1: ['#B87333', '#E3A86B'],
  2: ['#8E99A6', '#D5DCE3'],
  3: ['#C99A06', YELLOW],
  4: [BLUE, YELLOW],
};

/** SVG-tekst voor een badge ({ group, tier }); leeg als de groep (nog) geen plaatje heeft. */
export function badgeIconSvg({ group, tier = 0 }) {
  const motif = MOTIFS[group];
  if (!motif) return '';
  const [ring, inner] = RINGS[tier] ?? RINGS[0];
  const bg = group === 'foutloos' ? BLUE : '#EEF4FA';
  const flag = tier === 4
    ? `<circle cx="32" cy="32" r="29" fill="none" stroke="${YELLOW}" stroke-width="2" stroke-dasharray="4 3"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false" aria-hidden="true">`
    + `<circle cx="32" cy="32" r="30" fill="${ring}"/><circle cx="32" cy="32" r="27" fill="${inner}"/>`
    + `<circle cx="32" cy="32" r="25.5" fill="${bg}"/>${flag}${motif}</svg>`;
}

/** Groepen met een plaatje (voor de tests). */
export const BADGE_ICON_GROUPS = Object.keys(MOTIFS);
