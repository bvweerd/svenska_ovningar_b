// Klokkijken in het Zweeds: alle gangbare manieren om een tijd te zeggen.

export const HOURS = ['tolv', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv'];

export function parseTime(time) {
  const m = String(time).match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) throw new Error(`Ongeldige tijd: ${time}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59 || min % 5 !== 0) throw new Error(`Ongeldige tijd (alleen per 5 minuten): ${time}`);
  return { h, min };
}

/** Zweedse uitdrukkingen zonder "klockan är", meest gebruikelijke eerst. */
export function swedishTime(time) {
  const { h, min } = parseTime(time);
  const cur = HOURS[h % 12];
  const next = HOURS[(h + 1) % 12];
  switch (min) {
    case 0: return [`${cur}`, `prick ${cur}`];
    case 5: return [`fem över ${cur}`];
    case 10: return [`tio över ${cur}`];
    case 15: return [`kvart över ${cur}`];
    case 20: return [`tjugo över ${cur}`, `tio i halv ${next}`];
    case 25: return [`fem i halv ${next}`];
    case 30: return [`halv ${next}`];
    case 35: return [`fem över halv ${next}`];
    case 40: return [`tjugo i ${next}`, `tio över halv ${next}`];
    case 45: return [`kvart i ${next}`];
    case 50: return [`tio i ${next}`];
    case 55: return [`fem i ${next}`];
    default: return [];
  }
}

/** Antwoordpatronen voor de nakijker (met optioneel "klockan är"). */
export function clockAnswers(time) {
  return swedishTime(time).map((t) => `[Klockan är ]${t}`);
}

/** Bekende fouten met gerichte tips. */
export function clockFeedback(time) {
  const { h, min } = parseTime(time);
  const cur = HOURS[h % 12];
  const next = HOURS[(h + 1) % 12];
  const fb = [];
  if (min >= 25 && min <= 35) {
    fb.push({
      match: [`[klockan är ]halv ${cur}`, `[klockan är ]fem i halv ${cur}`, `[klockan är ]fem över halv ${cur}`],
      tip: `„Halv” werkt zoals in het Nederlands: half ${h % 12 === 0 ? 'één' : 'het volgende uur'}. Gebruik dus „${next}”.`,
    });
  }
  if (min === 15) fb.push({ match: [`[klockan är ]kvart i ${cur}`], tip: 'Kwart óver is „kvart över”, kwart vóór is „kvart i”.' });
  if (min === 45) fb.push({ match: [`[klockan är ]kvart över ${next}`, `[klockan är ]kvart i ${cur}`], tip: 'Kwart vóór het volgende uur: „kvart i” + het volgende uur.' });
  if (min === 30) fb.push({ match: [`[klockan är ]halv ${cur} över`, `[klockan är ]trettio över ${cur}`], tip: 'Half wordt „halv” + het volgende uur, net als in het Nederlands.' });
  return fb;
}
