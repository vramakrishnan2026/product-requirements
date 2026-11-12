// Product Spec Configurator — Cloudflare Worker (Phase 1)
// Bindings expected:
//   DB               D1 database (product-spec-db)
//   ACCESS_PASSWORD  secret: the shared password
//   SESSION_SECRET   secret (optional but recommended): random string used to sign login cookies
//   MCP_TOKEN        secret (optional): enables the ChatGPT/Claude MCP endpoint at /mcp/<MCP_TOKEN>
//
// The page HTML is injected at build time (see build.mjs) as HTML below.

const HTML = "__HTML__";
const SCHEMA = "__SCHEMA__";
let schemaReady = null; // creates tables on first request (safe to repeat)

// ---- shared form definition (src/form.js, inlined at build) ----
/*__FORM__*/


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

  if (path === '/mcp' || path.startsWith('/mcp/')) {
    if (!env.DB) return json({ error: 'D1 binding "DB" is not set' }, 500);
    schemaReady ??= ensureSchema(env).catch(e => { schemaReady = null; throw e; });
    await schemaReady;
    return handleMcp(req, env, url);
  }

  if (!path.startsWith('/api/')) {
    return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...securityHeaders() } });
  }

  if (!env.ACCESS_PASSWORD) return json({ error: 'ACCESS_PASSWORD secret is not set on this Worker' }, 500);
  if (!env.DB) return json({ error: 'D1 binding "DB" is not set on this Worker' }, 500);
  schemaReady ??= ensureSchema(env).catch(e => { schemaReady = null; throw e; });
  await schemaReady;

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
    return json({ spec: await saveSpec(env, null, body.data, body.status) }, 201);
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
      return json({ spec: await saveSpec(env, id, body.data, body.status, existing) });
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

// ---------------- saving (shared by the page and MCP) ----------------
async function saveSpec(env, id, data, status, existing) {
  const row = specColumns({ data, status });
  if (!id) {
    id = newId();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO specs (id, title, product_type, product_family, status, requested_by, data) VALUES (?,?,?,?,?,?,?)')
        .bind(id, row.title, row.product_type, row.product_family, row.status, row.requested_by, row.data),
      ...flattenStatements(env, id, data),
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO spec_history (spec_id, data, status) VALUES (?,?,?)').bind(id, existing.data, existing.status),
      env.DB.prepare(`UPDATE specs SET title=?, product_type=?, product_family=?, status=?, requested_by=?, data=?, updated_at=datetime('now') WHERE id=?`)
        .bind(row.title, row.product_type, row.product_family, row.status, row.requested_by, row.data, id),
      env.DB.prepare('DELETE FROM spec_values WHERE spec_id = ?').bind(id),
      ...flattenStatements(env, id, data),
    ]);
  }
  return getSpec(env, id);
}

// ---------------- MCP (ChatGPT plugin / Claude connector) ----------------
const MCP_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const FIELDS = Object.fromEntries(SECTIONS.flatMap(s => s.fields.map(f => [f.key, { ...f, section: s.id }])));

const INTERVIEW_GUIDE = `You are interviewing a product manager to capture a new product requirement for the Product Spec Configurator (building-automation hardware: thermostats, sensors, controllers, I/O modules).
Workflow:
1. Call get_spec_form first. It lists every question (key, label, type, allowed option values, and showIf conditions). Ask only questions whose showIf conditions are met by answers so far.
2. Ask whether to start a new requirement or continue one (list_specs / get_spec).
3. Go section by section in form order. Ask one short question at a time (this often runs in voice). For multi-selects, read out the options briefly. Accept "skip", "not sure" (use tbd where allowed) and move on.
4. Follow branches: e.g. RS-485 selected -> ask its protocols; Modbus RTU -> ask role; display other than none/LED -> ask size and orientation; reuse plastics = yes -> ask which family, no/tbd -> ask for an enclosure description.
5. Map spoken answers to the exact option values from get_spec_form. If an answer is ambiguous or doesn't fit (e.g. a thermostat described as a sensor, conflicting numbers), ask a clarifying question; never guess.
6. Save progress with save_spec after each section (merge=true), so nothing is lost if the call drops. The first save needs overview.title.
7. Features that are not in the form go into feat.custom as {name, need: required|nice|no|tbd, notes}.
8. At the end, read back a short summary, ask for corrections, set status to "submitted" if the user agrees, and give them the page link returned by save_spec.`;

const TOOLS = [
  { name: 'get_spec_form',
    description: 'Use this first in every requirements interview. Returns all sections and questions of the product requirement form: field keys, labels, types, allowed option values and showIf conditions (which earlier answers make a question relevant).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, title: 'Get requirement form' } },
  { name: 'list_specs',
    description: 'Use this when the user wants to continue, review or find an existing product requirement. Returns saved requirements (id, title, status, last updated), newest first.',
    inputSchema: { type: 'object', properties: { search: { type: 'string', description: 'Optional text to filter by title or requester' } }, additionalProperties: false },
    annotations: { readOnlyHint: true, title: 'List requirements' } },
  { name: 'get_spec',
    description: 'Use this to load one saved requirement with all its answers, e.g. to continue an interview or summarise it.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Requirement id from list_specs or save_spec' } }, required: ['id'], additionalProperties: false },
    annotations: { readOnlyHint: true, title: 'Get requirement' } },
  { name: 'save_spec',
    description: 'Use this to save answers to a product requirement. Omit id to create a new one (answers must then include overview.title). With merge=true (default) only the given keys change; pass null for a key to clear it. Values must use field keys and option values from get_spec_form. Returns the saved requirement, any rejected answers with reasons, the questions still unanswered, and a link to the page.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string', description: 'Existing requirement id; omit to create a new one' },
      answers: { type: 'object', description: 'Map of field key -> value. text/textarea/date: string; number: number; select: one option value; multi: array of option values; ynt: "yes" | "no" | "tbd"; features: array of {name, need, notes}' },
      status: { type: 'string', enum: ['draft', 'submitted', 'in_review', 'approved', 'archived'], description: 'Defaults to the current status (draft for new)' },
      merge: { type: 'boolean', description: 'Merge with saved answers (default true). false replaces all answers.' } },
      required: ['answers'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, title: 'Save requirement' } },
];

async function handleMcp(req, env, url) {
  const token = url.pathname.slice(5);
  if (!env.MCP_TOKEN) return json({ error: 'MCP is not enabled: set the MCP_TOKEN secret on this Worker' }, 503);
  if (!(await safeEqual(token, env.MCP_TOKEN, env))) return json({ error: 'Not found' }, 404);
  if (req.method === 'GET' || req.method === 'DELETE') return new Response(null, { status: 405, headers: { allow: 'POST' } });
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const msg = await req.json().catch(() => null);
  if (!msg) return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
  if (Array.isArray(msg)) {
    const out = (await Promise.all(msg.map(m => mcpMessage(m, env, url)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202 });
  }
  const res = await mcpMessage(msg, env, url);
  return res ? json(res) : new Response(null, { status: 202 });
}

async function mcpMessage(msg, env, url) {
  const { id, method, params = {} } = msg || {};
  const isNotification = id === undefined || id === null;
  const ok = result => isNotification ? null : { jsonrpc: '2.0', id, result };
  const fail = (code, message) => isNotification ? null : { jsonrpc: '2.0', id, error: { code, message } };
  try {
    switch (method) {
      case 'initialize': {
        const v = MCP_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : MCP_VERSIONS[0];
        return ok({ protocolVersion: v, capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'product-spec-configurator', title: 'Product Spec Configurator', version: '1.0.0' },
          instructions: INTERVIEW_GUIDE });
      }
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: TOOLS });
      case 'tools/call': {
        const r = await callTool(params.name, params.arguments || {}, env, url);
        return ok({ content: [{ type: 'text', text: JSON.stringify(r.data, null, 1) }], structuredContent: r.data, isError: !!r.isError });
      }
      default:
        if (method?.startsWith('notifications/')) return null;
        return fail(-32601, `Method not found: ${method}`);
    }
  } catch (e) {
    console.error(e);
    return isNotification ? null : { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true } };
  }
}

async function familyOptions(env) {
  const { results } = await env.DB.prepare('SELECT id, name FROM product_families WHERE active = 1 ORDER BY sort_order, name').all();
  return [...results.map(r => ({ v: r.id, l: r.name })), { v: 'tbd', l: 'TBD' }];
}
const optionsOf = (f, fams) => f.options === '@families' ? fams : (f.options || []);

function condOk(c, d) {
  const v = d[c.k];
  if ('eq' in c) return v === c.eq;
  if ('in' in c) return c.in.includes(v);
  if ('has' in c) return Array.isArray(v) && v.includes(c.has);
  if ('gt' in c) return Number(v) > c.gt;
  return true;
}
const fieldVisible = (f, d) => !f.showIf || [].concat(f.showIf).every(c => condOk(c, d));

function describeCond(c) {
  if ('eq' in c) return `${c.k} = ${c.eq}`;
  if ('in' in c) return `${c.k} in [${c.in.join(', ')}]`;
  if ('has' in c) return `${c.k} includes ${c.has}`;
  if ('gt' in c) return `${c.k} > ${c.gt}`;
  return '';
}

function checkValue(f, v, fams) {
  const allowed = optionsOf(f, fams).map(o => o.v);
  switch (f.type) {
    case 'text': case 'textarea': case 'date':
      return typeof v === 'string' ? { v: v.slice(0, 5000) } : { err: 'expected a string' };
    case 'number': {
      const n = typeof v === 'string' ? Number(v) : v;
      return typeof n === 'number' && isFinite(n) && n >= 0 ? { v: n } : { err: 'expected a number >= 0' };
    }
    case 'select':
      return allowed.includes(v) ? { v } : { err: `expected one of: ${allowed.join(', ')}` };
    case 'multi': {
      const arr = Array.isArray(v) ? v : [v];
      const bad = arr.filter(x => !allowed.includes(x));
      return bad.length ? { err: `unknown option(s) ${bad.join(', ')}; allowed: ${allowed.join(', ')}` } : { v: [...new Set(arr)] };
    }
    case 'yesno': case 'ynt': {
      const ok = f.type === 'ynt' ? ['yes', 'no', 'tbd'] : ['yes', 'no'];
      return ok.includes(v) ? { v } : { err: `expected one of: ${ok.join(', ')}` };
    }
    case 'features': {
      if (!Array.isArray(v)) return { err: 'expected an array of {name, need, notes}' };
      const rows = v.filter(r => r && typeof r.name === 'string' && r.name.trim()).map(r => ({
        name: r.name.trim().slice(0, 200), need: ['required', 'nice', 'no', 'tbd'].includes(r.need) ? r.need : 'tbd', notes: String(r.notes || '').slice(0, 1000) }));
      return { v: rows };
    }
  }
  return { err: 'unsupported field type' };
}

async function callTool(name, args, env, url) {
  const base = `${url.origin}/`;
  if (name === 'get_spec_form') {
    const fams = await familyOptions(env);
    return { data: { sections: SECTIONS.map(s => ({ id: s.id, title: s.title, note: s.desc || undefined, later_phase: s.phase || undefined,
      questions: s.fields.map(f => ({ key: f.key, label: f.label, type: f.type, unit: f.unit, hint: f.hint,
        options: f.options ? optionsOf(f, fams).map(o => ({ value: o.v, label: o.l })) : undefined,
        ask_only_if: f.showIf ? [].concat(f.showIf).map(describeCond).join(' AND ') : undefined })) })) } };
  }
  if (name === 'list_specs') {
    const q = `%${String(args.search || '').toLowerCase()}%`;
    const { results } = await env.DB.prepare(
      `SELECT id, title, status, requested_by, updated_at FROM specs WHERE lower(title) LIKE ? OR lower(coalesce(requested_by,'')) LIKE ? ORDER BY updated_at DESC LIMIT 50`).bind(q, q).all();
    return { data: { specs: results.map(r => ({ ...r, link: `${base}#spec/${r.id}` })) } };
  }
  if (name === 'get_spec') {
    const s = await getSpec(env, String(args.id || ''));
    if (!s) return { isError: true, data: { error: 'No requirement with that id. Use list_specs.' } };
    return { data: { id: s.id, title: s.title, status: s.status, updated_at: s.updated_at, answers: s.data, link: `${base}#spec/${s.id}` } };
  }
  if (name === 'save_spec') {
    const answers = args.answers && typeof args.answers === 'object' && !Array.isArray(args.answers) ? args.answers : null;
    if (!answers) return { isError: true, data: { error: 'answers must be an object of field key -> value' } };
    let existing = null, data = {};
    if (args.id) {
      existing = await env.DB.prepare('SELECT id, data, status FROM specs WHERE id = ?').bind(String(args.id)).first();
      if (!existing) return { isError: true, data: { error: 'No requirement with that id. Omit id to create a new one.' } };
      if (args.merge !== false) data = JSON.parse(existing.data);
    }
    const fams = await familyOptions(env);
    const rejected = [];
    for (const [k, v] of Object.entries(answers)) {
      const f = FIELDS[k];
      if (!f) { rejected.push({ key: k, reason: 'unknown field key (see get_spec_form)' }); continue; }
      if (v === null || v === '' || (Array.isArray(v) && !v.length)) { delete data[k]; continue; }
      const r = checkValue(f, v, fams);
      if (r.err) rejected.push({ key: k, value: v, reason: r.err }); else data[k] = r.v;
    }
    // drop answers to questions that no longer apply (same rule as the page)
    const dropped = [];
    for (const k of Object.keys(data)) if (!FIELDS[k] || !fieldVisible(FIELDS[k], data)) { dropped.push(k); delete data[k]; }
    if (!data['overview.title']) return { isError: true, data: { error: 'overview.title is required before the first save', rejected } };
    const status = STATUSES.includes(args.status) ? args.status : (existing?.status || 'draft');
    const s = await saveSpec(env, existing?.id || null, data, status, existing);
    const unanswered = SECTIONS.flatMap(sec => sec.fields.filter(f => fieldVisible(f, data) && !(f.key in data)).map(f => f.key));
    return { data: { id: s.id, title: s.title, status: s.status, saved_answers: Object.keys(data).length,
      rejected: rejected.length ? rejected : undefined, removed_no_longer_applicable: dropped.length ? dropped : undefined,
      unanswered, link: `${base}#spec/${s.id}` } };
  }
  return { isError: true, data: { error: `Unknown tool ${name}` } };
}

// ---------------- helpers ----------------
// Runs schema.sql (all IF NOT EXISTS / INSERT OR IGNORE) once per Worker instance.
async function ensureSchema(env) {
  const stmts = SCHEMA.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    .split(';').map(x => x.trim()).filter(Boolean);
  await env.DB.batch(stmts.map(sql => env.DB.prepare(sql)));
}

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
