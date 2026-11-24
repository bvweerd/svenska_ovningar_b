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
  // Makkelijke teksten lezen: open boek met blauw-gele bladwijzer
  lezen: `
<path d="M32 24 Q23 19 11 21 L11 47 Q23 45 32 50 Q41 45 53 47 L53 21 Q41 19 32 24 Z" fill="${FALU}"/>
<path d="M32 23 Q24 18 13.5 19.5 L13.5 44.5 Q24 43 32 47.5 Z" fill="${WHITE}" stroke="#9AA1AD" stroke-width="0.7"/>
<path d="M32 23 Q40 18 50.5 19.5 L50.5 44.5 Q40 43 32 47.5 Z" fill="${WHITE}" stroke="#9AA1AD" stroke-width="0.7"/>
<path d="M17 25 Q23 24 28.5 26.5 M17 29.5 Q23 28.5 28.5 31 M17 34 Q23 33 28.5 35.5 M17 38.5 Q22 37.5 26 39.5 M35.5 26.5 Q41 24 47 25 M35.5 31 Q41 28.5 47 29.5" fill="none" stroke="#9AA1AD" stroke-width="1" stroke-linecap="round"/>
<path d="M39 21.5 L39 41 L41.5 38.5 L44 41 L44 20.6 Z" fill="${BLUE}"/><rect x="39" y="30" width="5" height="1.8" fill="${YELLOW}"/>`,

  // Luisteren: näverlur (herdershoorn van berkenbast) met geluidsgolven
  luisteren: `
<g transform="translate(31 35) scale(0.84) translate(-32 -32)">
<g transform="rotate(-28 32 32)">
<path d="M11 30.8 L42 28 Q47 27 51 24.5 L51 39.5 Q47 37 42 36 L11 33.2 Z" fill="#EFE4CC" stroke="#8A6A3A" stroke-width="0.8" stroke-linejoin="round"/>
<g fill="#5A3A1E"><rect x="18" y="30.2" width="1.6" height="3.6"/><rect x="27" y="29.5" width="1.8" height="5"/><rect x="36" y="28.6" width="2" height="6.8"/><rect x="45.5" y="26.4" width="1.6" height="11.2"/></g>
<rect x="9" y="30.4" width="3" height="3.2" rx="0.8" fill="#5A3A1E"/>
</g>
<path d="M47 11 q4 3 3.5 8 M50.5 8 q6 5 4.5 13" fill="none" stroke="${BLUE}" stroke-width="1.6" stroke-linecap="round"/>
<path d="M44 14 q2.5 2 2.2 5" fill="none" stroke="${YELLOW}" stroke-width="1.6" stroke-linecap="round"/></g>`,

  // Wat zeg je?: tekstballonnen
  zeggen: `
<path d="M14 17 H44 Q48 17 48 21 V33 Q48 37 44 37 H27 L19 44 L21 37 H14 Q10 37 10 33 V21 Q10 17 14 17 Z" fill="${BLUE}"/>
<text x="29" y="31.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="${WHITE}">Hej!</text>
<path d="M38 36 H50 Q53 36 53 39 V45 Q53 48 50 48 H48 L49.5 52 L44 48 H38 Q35 48 35 45 V39 Q35 36 38 36 Z" fill="${YELLOW}" stroke="#B88A00" stroke-width="0.8"/>
<circle cx="40" cy="42" r="1.2" fill="${INK}"/><circle cx="44" cy="42" r="1.2" fill="${INK}"/><circle cx="48" cy="42" r="1.2" fill="${INK}"/>`,

  // Schrijven: runensteen met slingerende runenband
  schrijven: `
<ellipse cx="32" cy="50" rx="15" ry="2.8" fill="#7CB342"/>
<path d="M21 50 Q18 31 22.5 19 Q32 9 41.5 19 Q46 31 43 50 Z" fill="#9AA0A8" stroke="#666C75" stroke-width="0.8"/>
<path d="M25.5 49 Q23 31 26.5 21.5 Q32 14 37.5 21.5 Q41 31 38.5 49" fill="none" stroke="${FALU}" stroke-width="3.2" stroke-linecap="round"/>
<path d="M25.2 44 l1.4 -2 M24.8 38 l1.6 1 M24.9 32 l1.4 -1.5 M25.8 26 l1.6 1.2 M29 19.5 l0.8 1.8 M34.2 19.2 l-0.6 1.9 M37.4 23.5 l1.6 -0.8 M38.6 29 l1.4 1.2 M39.2 35 l1.2 -1.4 M39.2 41 l1.4 1 M38.8 46 l1.4 -1.2" stroke="${WHITE}" stroke-width="0.8" stroke-linecap="round"/>
<path d="M30.5 26 V40 M30.5 30 L34 27 M30.5 34 L34 31 M34.5 33 V43 M34.5 36 L31.5 39" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`,

  // Doeltaken: trätoffel (houten klomp met leren kap)
  taak: `
<path d="M10 40 L54 40 L54 43 Q54 47 50 47 L14 47 Q10 47 10 43 Z" fill="${WOOD}" stroke="#7A4A1E" stroke-width="0.8"/>
<path d="M22 40 Q21 25 35 24.5 Q48 25 52 37 L52 40 Z" fill="${FALU}" stroke="#6E181B" stroke-width="0.8"/>
<path d="M22 40 Q22 33 28 31" fill="none" stroke="#6E181B" stroke-width="1"/>
<g fill="${YELLOW}"><circle cx="24" cy="38.5" r="0.9"/><circle cx="24.3" cy="33" r="0.9"/><circle cx="27" cy="28" r="0.9"/><circle cx="32" cy="25.6" r="0.9"/><circle cx="38" cy="25.6" r="0.9"/><circle cx="43.5" cy="27.6" r="0.9"/><circle cx="48" cy="31.5" r="0.9"/><circle cx="51" cy="36.5" r="0.9"/></g>
<path d="M38 33 l1.5 -2.5 l1.5 2.5 l-1.5 2.5 Z M34.5 34 h3 M41 34 h3" fill="${WHITE}" stroke="${WHITE}" stroke-width="0.8" stroke-linejoin="round"/>`,

  // Dagdoel herhaling: köttbullar met lingon
  dagdoel: `
<ellipse cx="32" cy="38" rx="21" ry="10.5" fill="${WHITE}" stroke="#9AA1AD" stroke-width="0.8"/>
<ellipse cx="32" cy="38" rx="15" ry="7" fill="none" stroke="${BLUE}" stroke-width="0.8"/>
<g fill="#7A4A26" stroke="#4E2C14" stroke-width="0.6">
<circle cx="24" cy="35.5" r="4.6"/><circle cx="33" cy="33" r="4.6"/><circle cx="28.5" cy="40.5" r="4.6"/><circle cx="37.5" cy="39.5" r="4.6"/></g>
<g fill="#B47A4A"><circle cx="22.6" cy="34" r="1.3"/><circle cx="31.6" cy="31.5" r="1.3"/><circle cx="27.1" cy="39" r="1.3"/><circle cx="36.1" cy="38" r="1.3"/></g>
<g fill="#C62828" stroke="#7F1414" stroke-width="0.4"><circle cx="45" cy="36" r="1.6"/><circle cx="47.5" cy="38.5" r="1.6"/><circle cx="44.5" cy="39.5" r="1.6"/><circle cx="47.5" cy="35" r="1.4"/><circle cx="46" cy="41.8" r="1.4"/></g>
<path d="M43 33 q2 -4 6 -3.5 q-2 3.5 -6 3.5 Z" fill="${GREEN}"/>
<path d="M20 22 q-2 -3 0 -6 M27 22 q-2 -3 0 -6 M34 21 q-2 -3 0 -6" fill="none" stroke="#9AA1AD" stroke-width="1.1" stroke-linecap="round"/>`,

  // Hoofdstuk beheerst: kräfta
  hoofdstukbeheerst: `
<g transform="translate(32 34.5) scale(0.76) translate(-32 -32)">
<g fill="#C62828" stroke="#7F1414" stroke-width="0.7" stroke-linejoin="round">
<path d="M28.5 25 Q24 22 22 18 L20 15" fill="none" stroke-width="2"/><path d="M35.5 25 Q40 22 42 18 L44 15" fill="none" stroke-width="2"/>
<path d="M20 15 Q13 15 13 9.5 Q16 12 19 11.5 Q17 9 18.5 6.5 Q23 9 22.5 13.5 Z"/>
<path d="M44 15 Q51 15 51 9.5 Q48 12 45 11.5 Q47 9 45.5 6.5 Q41 9 41.5 13.5 Z"/>
<ellipse cx="32" cy="28" rx="5.6" ry="8"/>
<rect x="27.6" y="35" width="8.8" height="3.4" rx="1.4"/><rect x="28" y="38.2" width="8" height="3.2" rx="1.4"/><rect x="28.5" y="41.2" width="7" height="3" rx="1.3"/>
<path d="M32 43.5 L26 50 Q32 52 38 50 Z"/></g>
<path d="M27 29 L21 31 M27 32 L21.5 35 M27.4 35 L23 39 M37 29 L43 31 M37 32 L42.5 35 M36.6 35 L41 39" stroke="#7F1414" stroke-width="1.1" stroke-linecap="round"/>
<path d="M30 21 Q26 14 22 11 M34 21 Q38 14 42 11" fill="none" stroke="#7F1414" stroke-width="0.6"/>
<circle cx="30" cy="23" r="0.9" fill="${INK}"/><circle cx="34" cy="23" r="0.9" fill="${INK}"/>
<path d="M50 44 q2 -4 1 -8 M50 44 q-3 -2 -4 -5 M50 44 q3 -1 4 -4" fill="none" stroke="${GREEN}" stroke-width="0.9" stroke-linecap="round"/></g>`,

  // Vlot herhalen: vikingschip
  vlot: `
<path d="M10 48 q3 -2 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0" fill="none" stroke="${BLUE}" stroke-width="1.6" stroke-linecap="round"/>
<path d="M12 36 Q14 45 32 45 Q50 45 52 36 Q32 40 12 36 Z" fill="${WOOD}" stroke="#7A4A1E" stroke-width="0.8"/>
<path d="M13 37 Q9 29 12.5 24.5 Q15.5 22 17 25.5 L14.5 26" fill="none" stroke="#7A4A1E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M51 37 Q55 30 52 26" fill="none" stroke="#7A4A1E" stroke-width="2.4" stroke-linecap="round"/>
<rect x="31.2" y="12" width="1.6" height="26" fill="#5A3412"/>
<rect x="21" y="14" width="22" height="18" fill="${WHITE}" stroke="#9AA1AD" stroke-width="0.6"/>
<g fill="${FALU}"><rect x="21" y="14" width="4.4" height="18"/><rect x="29.8" y="14" width="4.4" height="18"/><rect x="38.6" y="14" width="4.4" height="18"/></g>
<g stroke="#7A4A1E" stroke-width="0.5"><circle cx="18" cy="39" r="2" fill="${YELLOW}"/><circle cx="23.5" cy="40.3" r="2" fill="${BLUE}"/><circle cx="29" cy="41" r="2" fill="${YELLOW}"/><circle cx="35" cy="41" r="2" fill="${BLUE}"/><circle cx="40.5" cy="40.3" r="2" fill="${YELLOW}"/><circle cx="46" cy="39" r="2" fill="${BLUE}"/></g>`,

  // En of ett?: falukorv
  'en-ett': `
<path d="M17 43 A15.5 15.5 0 1 1 47 43" fill="none" stroke="#7E2A1C" stroke-width="10.5" stroke-linecap="round"/>
<path d="M17 43 A15.5 15.5 0 1 1 47 43" fill="none" stroke="#B5452F" stroke-width="8.5" stroke-linecap="round"/>
<path d="M19.5 37 A13 13 0 0 1 32 22.5" fill="none" stroke="#D9735C" stroke-width="2" stroke-linecap="round"/>
<path d="M22 31 q3 -3 1 -6 q4 -1 3 -5 M36 20 q3 3 7 1 q0 4 3 6" fill="none" stroke="${YELLOW}" stroke-width="1.5" stroke-linecap="round"/>
<rect x="14" y="44.5" width="6" height="3.2" rx="0.8" fill="#9AA1AD"/><rect x="44" y="44.5" width="6" height="3.2" rx="0.8" fill="#9AA1AD"/>
<ellipse cx="32" cy="46.5" rx="5.5" ry="4" fill="#E9A493" stroke="#7E2A1C" stroke-width="1.2"/>
<g fill="#F6D2C8"><circle cx="30.5" cy="45.5" r="0.7"/><circle cx="33.6" cy="47.4" r="0.7"/><circle cx="31.5" cy="48.2" r="0.6"/></g>`,

  // Alle hoofdstukken af: hembränt en een snapsglas (skål!)
  alles: `
<path d="M20 22 h7 v4 Q32 29 32 34 V48 Q32 51 29 51 H18 Q15 51 15 48 V34 Q15 29 20 26 Z" fill="#DDEFF7" stroke="#7FA7BF" stroke-width="0.9"/>
<path d="M15.6 36 H31.4 V48 Q31.4 50.4 29 50.4 H18 Q15.6 50.4 15.6 48 Z" fill="#F4FAFD"/>
<rect x="19.5" y="16" width="8" height="6.5" rx="1" fill="#B5793A" stroke="#7A4A1E" stroke-width="0.7"/>
<rect x="17.5" y="38" width="12" height="8.5" fill="${WHITE}" stroke="#9AA1AD" stroke-width="0.6" transform="rotate(-4 23.5 42)"/>
<path d="M19 41 h8 M19.5 43.8 h6" stroke="${BLUE}" stroke-width="1" stroke-linecap="round" transform="rotate(-4 23.5 42)"/>
<path d="M38 32 H49 L47 46 Q46.5 48 43.5 48 Q40.5 48 40 46 Z" fill="#DDEFF7" stroke="#7FA7BF" stroke-width="0.9"/>
<path d="M38.6 36 H48.4 L46.9 45.7 Q46.4 47.4 43.5 47.4 Q40.6 47.4 40.1 45.7 Z" fill="#F4FAFD"/>
<rect x="41.5" y="48" width="4" height="2.4" fill="#7FA7BF"/>
<g stroke="${YELLOW}" stroke-width="1.5" stroke-linecap="round"><path d="M43.5 21 v5 M37 24 l2.5 3.5 M50 24 l-2.5 3.5"/></g>`,
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
