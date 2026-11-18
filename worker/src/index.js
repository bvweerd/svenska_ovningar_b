// Cloudflare Worker: ontvangt een foutmelding van de oefensite en maakt er een GitHub-issue van.
// Gebruikers hebben geen GitHub-account nodig. Turnstile houdt bots tegen; het GitHub-token
// staat alleen hier, als secret, en kan alleen issues aanmaken in de ingestelde repo.
//
// Instellingen (wrangler.toml / secrets):
//   GITHUB_REPO       "eigenaar/repo", of een komma-gescheiden lijst. De eerste is de standaard;
//                     een site kiest een andere uit de lijst met het veld "repo" in de melding.
//   ALLOWED_ORIGINS   komma-gescheiden lijst, bijv. https://bvweerd.github.io,http://localhost:5173
//   ISSUE_LABELS      optioneel, komma-gescheiden, bijv. melding
//   GITHUB_TOKEN      secret: fine-grained token met alleen "Issues: Read and write" op de repo's in GITHUB_REPO
//   TURNSTILE_SECRET  secret: geheime sleutel van de Turnstile-widget

export const LIMITS = { message: 2000, answer: 1000, item: 6000, short: 200 };

const clip = (v, n) => String(v ?? '').trim().slice(0, n);

/** Voorkomt dat tekst van gebruikers mensen pingt (@naam) of als HTML wordt gelezen. */
export function neutralize(text) {
  return String(text).replace(/@/g, '@​').replace(/</g, '&lt;');
}

/** Codeblok waarvan het hek langer is dan elke reeks backticks in de inhoud. */
function fence(content, lang = '') {
  const longest = Math.max(2, ...[...String(content).matchAll(/`+/g)].map((m) => m[0].length));
  const f = '`'.repeat(longest + 1);
  return `${f}${lang}\n${content}\n${f}`;
}

/** Maakt titel en tekst van het issue. Geeft null als de melding niet bruikbaar is. */
export function buildIssue(p) {
  const message = clip(p?.message, LIMITS.message);
  if (message.length < 3) return null;
  const chapter = Number.isInteger(p.chapter) ? p.chapter : null;
  const exercise = clip(p.exercise, LIMITS.short);
  const exerciseTitle = clip(p.exerciseTitle, LIMITS.short);
  const idx = Number.isInteger(p.itemIndex) ? p.itemIndex : null;
  const itemId = clip(p.itemId, 60).replace(/[`|\n]/g, '') || null;
  const shown = Number.isInteger(p.shownNumber) ? p.shownNumber : null;
  const page = clip(p.page, 500);

  const where = [
    chapter !== null ? `H${chapter}` : null,
    exerciseTitle || exercise || null,
    itemId ? `id ${itemId}` : idx !== null ? `items[${idx}]` : null,
  ].filter(Boolean).join(' · ');
  const summary = message.split('\n')[0].slice(0, 60);
  const title = `Melding${where ? ` ${where}` : ''}: ${summary}${message.length > summary.length ? '…' : ''}`;

  const rows = [
    chapter !== null ? `| Hoofdstuk | ${chapter} |` : null,
    exercise ? `| Oefening | \`${exercise.replace(/`/g, '')}\`${exerciseTitle ? ` (${neutralize(exerciseTitle)})` : ''} |` : null,
    itemId || idx !== null || shown !== null
      ? `| Vraag | ${[itemId ? `id \`${neutralize(itemId)}\`` : null, idx !== null ? `\`items[${idx}]\`` : null, shown !== null ? `nr. ${shown} op het scherm` : null].filter(Boolean).join(', ')} |`
      : null,
    p.itemType ? `| Type | ${neutralize(clip(p.itemType, 30))} |` : null,
    page && /^https?:\/\//.test(page) ? `| Pagina | ${page} |` : null,
  ].filter(Boolean);

  const parts = [
    '### Melding',
    message.split('\n').map((l) => `> ${neutralize(l)}`).join('\n'),
  ];
  if (rows.length) parts.push('### Waar', '| | |\n|---|---|\n' + rows.join('\n'));
  const answer = clip(p.answer, LIMITS.answer);
  if (answer) parts.push('### Antwoord van de gebruiker', fence(answer));
  const item = clip(p.item, LIMITS.item);
  if (item) parts.push('<details><summary>Vraag (uit de content)</summary>\n', fence(item, 'json'), '\n</details>');
  parts.push('_Automatisch aangemaakt via het meldformulier op de site._');
  return { title: title.slice(0, 250), body: parts.join('\n\n') };
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const list = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** De repo voor deze melding: de gevraagde als die op de lijst staat, anders de eerste. */
export function pickRepo(requested, env) {
  const repos = list(env.GITHUB_REPO);
  const want = String(requested ?? '').trim().toLowerCase();
  return repos.find((r) => r.toLowerCase() === want) ?? repos[0];
}

const json = (status, data, headers) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export async function handle(request, env, fetchImpl = fetch) {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = list(env.ALLOWED_ORIGINS);
  if (!allowed.includes(origin)) return json(403, { ok: false, error: 'origin' });
  const headers = cors(origin);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method' }, headers);

  const raw = await request.text();
  if (raw.length > 20000) return json(413, { ok: false, error: 'te groot' }, headers);
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: 'json' }, headers);
  }

  const issue = buildIssue(payload);
  if (!issue) return json(400, { ok: false, error: 'leeg' }, headers);

  // Turnstile: is dit een mens?
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', String(payload.token ?? ''));
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  const ts = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const verdict = await ts.json().catch(() => ({}));
  if (!verdict.success) return json(403, { ok: false, error: 'turnstile' }, headers);

  const labels = list(env.ISSUE_LABELS);
  const repo = pickRepo(payload.repo, env);
  const gh = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'svensk-ovningar-meldingen',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...issue, ...(labels.length ? { labels } : {}) }),
  });
  if (!gh.ok) {
    console.error('GitHub', repo, gh.status, await gh.text().catch(() => ''));
    return json(502, { ok: false, error: 'github' }, headers);
  }
  const created = await gh.json();
  return json(201, { ok: true, number: created.number }, headers);
}

export default { fetch: (request, env) => handle(request, env) };
