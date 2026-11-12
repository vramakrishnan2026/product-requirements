// Product Spec Configurator — Cloudflare Worker (Phase 1)
// Bindings expected:
//   DB               D1 database (product-spec-db)
//   ACCESS_PASSWORD  secret: the shared password
//   SESSION_SECRET   secret (optional but recommended): random string used to sign login cookies
//
// The page HTML is injected at build time (see build.mjs) as HTML below.

const HTML = "__HTML__";

const COOKIE = 'psc_session';
const SESSION_DAYS = 30;
const enc = new TextEncoder();

export default {
  async fetch(req, env) {
    try {
      return await route(req, env);
    } catch (err) {
      console.error(err);
      return json({ error: 'Server error: ' + (err.message || err) }, 500);
    }
  },
};

async function route(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (!path.startsWith('/api/')) {
    return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...securityHeaders() } });
  }

  if (!env.ACCESS_PASSWORD) return json({ error: 'ACCESS_PASSWORD secret is not set on this Worker' }, 500);
  if (!env.DB) return json({ error: 'D1 binding "DB" is not set on this Worker' }, 500);

  // ---- auth ----
  if (path === '/api/login' && method === 'POST') {
    const { password } = await req.json().catch(() => ({}));
    if (!(await safeEqual(String(password || ''), env.ACCESS_PASSWORD, env))) {
      await new Promise(r => setTimeout(r, 600)); // slow down guessing
      return json({ error: 'Wrong password' }, 401);
    }
    const exp = Date.now() + SESSION_DAYS * 864e5;
    const token = `${exp}.${await sign(String(exp), env)}`;
    return json({ ok: true }, 200, { 'set-cookie': cookie(token, SESSION_DAYS * 86400, url) });
  }
  if (path === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': cookie('', 0, url) });
  }
  if (!(await authed(req, env))) return json({ error: 'unauthorized' }, 401);

  // ---- data ----
  if (path === '/api/families' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, name, notes FROM product_families WHERE active = 1 ORDER BY sort_order, name').all();
    return json({ families: results });
  }

  if (path === '/api/specs' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, title, product_type, product_family, status, requested_by, created_at, updated_at FROM specs ORDER BY updated_at DESC LIMIT 500'
    ).all();
    return json({ specs: results });
  }

  if (path === '/api/specs' && method === 'POST') {
    const body = await readSpecBody(req);
    if (body.error) return json(body, 400);
    const id = newId();
    const row = specColumns(body);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO specs (id, title, product_type, product_family, status, requested_by, data) VALUES (?,?,?,?,?,?,?)')
        .bind(id, row.title, row.product_type, row.product_family, row.status, row.requested_by, row.data),
      ...flattenStatements(env, id, body.data),
    ]);
    return json({ spec: await getSpec(env, id) }, 201);
  }

  const m = path.match(/^\/api\/specs\/([\w-]+)(\/history)?$/);
  if (m) {
    const id = m[1];
    const existing = await env.DB.prepare('SELECT id, data, status FROM specs WHERE id = ?').bind(id).first();
    if (!existing) return json({ error: 'Not found' }, 404);

    if (m[2] && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT status, saved_at, data FROM spec_history WHERE spec_id = ? ORDER BY saved_at DESC LIMIT 50').bind(id).all();
      return json({ history: results.map(h => ({ ...h, data: JSON.parse(h.data) })) });
    }
    if (method === 'GET') return json({ spec: await getSpec(env, id) });

    if (method === 'PUT') {
      const body = await readSpecBody(req);
      if (body.error) return json(body, 400);
      const row = specColumns(body);
      await env.DB.batch([
        env.DB.prepare('INSERT INTO spec_history (spec_id, data, status) VALUES (?,?,?)').bind(id, existing.data, existing.status),
        env.DB.prepare(`UPDATE specs SET title=?, product_type=?, product_family=?, status=?, requested_by=?, data=?, updated_at=datetime('now') WHERE id=?`)
          .bind(row.title, row.product_type, row.product_family, row.status, row.requested_by, row.data, id),
        env.DB.prepare('DELETE FROM spec_values WHERE spec_id = ?').bind(id),
        ...flattenStatements(env, id, body.data),
      ]);
      return json({ spec: await getSpec(env, id) });
    }

    if (method === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM spec_values WHERE spec_id = ?').bind(id),
        env.DB.prepare('DELETE FROM spec_history WHERE spec_id = ?').bind(id),
        env.DB.prepare('DELETE FROM specs WHERE id = ?').bind(id),
      ]);
      return json({ ok: true });
    }
  }

  return json({ error: 'Not found' }, 404);
}

// ---------------- helpers ----------------
const STATUSES = ['draft', 'submitted', 'in_review', 'approved', 'archived'];

async function readSpecBody(req) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.data !== 'object' || Array.isArray(body.data)) return { error: 'Body must be { data: {...}, status }' };
  const title = String(body.data['overview.title'] || '').trim();
  if (!title) return { error: 'overview.title is required' };
  const raw = JSON.stringify(body.data);
  if (raw.length > 200_000) return { error: 'Spec is too large' };
  return { data: body.data, status: STATUSES.includes(body.status) ? body.status : 'draft' };
}

function specColumns({ data, status }) {
  const fam = data['mech.reuse'] === 'yes' ? data['mech.family'] : data['overview.base_family'];
  return {
    title: String(data['overview.title']).slice(0, 200),
    product_type: data['overview.product_type'] || null,
    product_family: fam || null,
    status,
    requested_by: data['overview.requested_by'] ? String(data['overview.requested_by']).slice(0, 200) : null,
    data: JSON.stringify(data),
  };
}

// One row per answer (one per option for multi-selects). Phase 2 matching and
// Phase 3 BOQ costing read from spec_values instead of parsing JSON.
function flattenStatements(env, specId, data) {
  const rows = [];
  for (const [key, v] of Object.entries(data)) {
    const section = key.split('.')[0];
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === 'object') {           // feature list rows
          const name = String(item.name || '').trim();
          if (!name) continue;
          rows.push([section, key, name.toLowerCase(), null]);
          rows.push([section, `${key}.${slug(name)}`, String(item.need || ''), null]);
        } else {
          rows.push([section, key, String(item), null]);
        }
      }
    } else if (typeof v === 'number') {
      rows.push([section, key, String(v), v]);
    } else if (v !== null && v !== undefined && v !== '') {
      rows.push([section, key, String(v).slice(0, 2000), null]);
    }
  }
  return rows.map(r => env.DB.prepare('INSERT INTO spec_values (spec_id, section, key, value, num_value) VALUES (?,?,?,?,?)').bind(specId, ...r));
}

async function getSpec(env, id) {
  const s = await env.DB.prepare('SELECT * FROM specs WHERE id = ?').bind(id).first();
  return s ? { ...s, data: JSON.parse(s.data) } : null;
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);

function newId() {
  const t = Date.now().toString(36);
  const r = crypto.getRandomValues(new Uint8Array(6));
  return `spec-${t}-${[...r].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
}

function securityHeaders() {
  return { 'x-frame-options': 'DENY', 'referrer-policy': 'same-origin', 'x-content-type-options': 'nosniff' };
}

function cookie(value, maxAge, url) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function hmacKey(env) {
  // Changing the password (or SESSION_SECRET) signs everyone out.
  const secret = `${env.SESSION_SECRET || ''}::${env.ACCESS_PASSWORD}`;
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function sign(msg, env) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function safeEqual(a, b, env) {
  // compare HMACs so timing does not leak the password
  const [x, y] = await Promise.all([sign('pw:' + a, env), sign('pw:' + b, env)]);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.min(x.length, y.length); i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
async function authed(req, env) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await sign(exp, env), env);
}
