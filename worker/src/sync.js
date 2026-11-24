// Synchronisatie van voortgang tussen apparaten, opgeslagen in Cloudflare D1.
//
//   GET /sync/<code>?site=<site>[&since=<rev>]  → { ok, rev, data? }   (data weg als rev === since; rev 0 = nog niets)
//   PUT /sync/<code>?site=<site>   body { rev, data } → { ok, rev }  of 409 { ok: false, rev, data } als iemand anders
//                                   intussen heeft opgeslagen: dan voegt de site samen en probeert opnieuw.
//
// De synccode is de enige sleutel (geen account). In de database staat alleen een SHA-256-hash van de code,
// met de site, een volgnummer en de voortgang als JSON. Samenvoegen gebeurt in de browser, niet hier.
//
// Instellingen:
//   DB          D1-binding (zie wrangler.toml en migrations/)
//   SYNC_SITES  komma-gescheiden opslagvoorvoegsels van de sites, bijv. svensk-ovningar,svensk-ovningar-b

export const SYNC_LIMIT = 1_000_000; // tekens JSON per site; D1 staat 2 MB per rij toe

/** Een synccode: 16 tekens uit het Crockford-alfabet (80 bits), met of zonder streepjes. */
export const CODE_RE = /^[0-9abcdefghjkmnpqrstvwxyz]{16}$/;

const list = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param url    URL van het verzoek (pad /sync/<code>)
 * @param json   (status, data) → Response, met de CORS-headers al erin
 */
export async function handleSync(request, env, url, json) {
  if (!env.DB) return json(503, { ok: false, error: 'sync uit' });
  const code = decodeURIComponent(url.pathname.split('/')[2] ?? '').toLowerCase().replace(/-/g, '');
  if (!CODE_RE.test(code)) return json(400, { ok: false, error: 'code' });
  const site = url.searchParams.get('site') ?? '';
  if (!list(env.SYNC_SITES).includes(site)) return json(400, { ok: false, error: 'site' });
  const id = await sha256(code);
  const current = () => env.DB.prepare('SELECT rev, data FROM progress WHERE id = ? AND site = ?').bind(id, site).first();

  if (request.method === 'GET') {
    const row = await current();
    if (!row) return json(200, { ok: true, rev: 0 });
    const since = Number(url.searchParams.get('since'));
    if (since === row.rev) return json(200, { ok: true, rev: row.rev });
    return json(200, { ok: true, rev: row.rev, data: JSON.parse(row.data) });
  }

  if (request.method !== 'PUT') return json(405, { ok: false, error: 'method' });
  const raw = await request.text();
  if (raw.length > SYNC_LIMIT + 100) return json(413, { ok: false, error: 'te groot' });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: 'json' });
  }
  const data = body?.data;
  if (!Number.isInteger(body?.rev) || body.rev < 0 || !data || typeof data !== 'object' || Array.isArray(data) || data.v !== 2) {
    return json(400, { ok: false, error: 'data' });
  }
  const text = JSON.stringify(data);
  if (text.length > SYNC_LIMIT) return json(413, { ok: false, error: 'te groot' });

  const now = Date.now();
  const res = body.rev === 0
    ? await env.DB.prepare('INSERT INTO progress (id, site, rev, data, updated) VALUES (?, ?, 1, ?, ?) ON CONFLICT DO NOTHING')
      .bind(id, site, text, now).run()
    : await env.DB.prepare('UPDATE progress SET rev = rev + 1, data = ?, updated = ? WHERE id = ? AND site = ? AND rev = ?')
      .bind(text, now, id, site, body.rev).run();
  if (res.meta?.changes === 1) return json(200, { ok: true, rev: body.rev + 1 });

  // Iemand anders was eerder: stuur de huidige stand terug.
  const row = await current();
  return json(409, { ok: false, error: 'conflict', rev: row?.rev ?? 0, ...(row ? { data: JSON.parse(row.data) } : {}) });
}
