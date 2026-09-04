// ==========================================================================
// RitasiCounter API - Cloudflare Worker (SATU FILE, TANPA DEPENDENCY NPM)
// Tinggal paste seluruh isi file ini ke "Quick edit" / "Edit code" di
// dashboard Cloudflare Workers. Butuh binding D1 bernama "DB" dan
// environment variable "JWT_SECRET" (lihat README-MOBILE.md).
// ==========================================================================

const MATERIALS = ['OB', 'COAL', 'SOIL', 'SOLU', 'MUD'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

// ===================== PASSWORD (PBKDF2 via Web Crypto) =====================
function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes;
}
async function verifyPassword(password, stored) {
  const parts = (stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = fromHex(parts[2]);
  const expectedHex = parts[3];
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
  const actualHex = toHex(bits);
  if (actualHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHex.length; i++) diff |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}

// ===================== JWT (HMAC-SHA256 via Web Crypto) =====================
function base64url(input) {
  let str = typeof input === 'string' ? btoa(input) : btoa(String.fromCharCode(...new Uint8Array(input)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const data = encHeader + '.' + encPayload;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return data + '.' + base64url(sig);
}
async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token tidak valid');
  const [encHeader, encPayload, encSig] = parts;
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, base64urlDecode(encSig), new TextEncoder().encode(encHeader + '.' + encPayload));
  if (!valid) throw new Error('Signature tidak valid');
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(encPayload)));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) throw new Error('Token kedaluwarsa');
  return payload;
}
async function requireAuth(req, env) {
  const header = req.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: json({ error: 'Token tidak ditemukan. Silakan login.' }, 401) };
  try {
    const user = await verifyJWT(token, env.JWT_SECRET);
    return { user };
  } catch (e) {
    return { error: json({ error: 'Token tidak valid atau kedaluwarsa.' }, 401) };
  }
}

// ===================== SHIFT =====================
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
async function getAllShifts(db) {
  return (await db.prepare('SELECT * FROM shifts ORDER BY id').all()).results;
}
async function getActiveShift(db) {
  const shifts = await getAllShifts(db);
  const now = new Date();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  for (const s of shifts) {
    const start = toMinutes(s.start);
    const end = toMinutes(s.end);
    if (start < end) { if (nowMinutes >= start && nowMinutes < end) return s; }
    else { if (nowMinutes >= start || nowMinutes < end) return s; }
  }
  return shifts[0];
}
async function resolveShift(db, shiftParam) {
  if (!shiftParam || shiftParam === 'active') return getActiveShift(db);
  const shifts = await getAllShifts(db);
  return shifts.find((s) => String(s.id) === String(shiftParam)) || getActiveShift(db);
}

// ===================== ROUTE HANDLERS =====================

async function handleLogin(req, env) {
  const body = await req.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password) return json({ error: 'username dan password wajib diisi' }, 400);
  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return json({ error: 'Username atau password salah' }, 401);
  }
  const payload = { id: user.id, username: user.username, name: user.name, role: user.role, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 };
  const token = await signJWT(payload, env.JWT_SECRET);
  return json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
}

async function handleMe(user) {
  return json({ user });
}

async function handleGetUnits(env) {
  const result = await env.DB.prepare('SELECT * FROM units ORDER BY name').all();
  return json(result.results);
}

async function handleCreateUnit(req, env) {
  const body = await req.json().catch(() => ({}));
  const { name, fleet, pit } = body;
  if (!name || !fleet || !pit) return json({ error: 'name, fleet, dan pit wajib diisi' }, 400);
  const existing = await env.DB.prepare('SELECT id FROM units WHERE name = ?').bind(name).first();
  if (existing) return json({ error: `Unit ${name} sudah ada` }, 409);
  const result = await env.DB.prepare('INSERT INTO units (name, fleet, pit) VALUES (?, ?, ?)').bind(name, fleet, pit).run();
  const unit = await env.DB.prepare('SELECT * FROM units WHERE id = ?').bind(result.meta.last_row_id).first();
  return json(unit, 201);
}

async function handleUpdateUnit(req, env, id) {
  const body = await req.json().catch(() => ({}));
  const existing = await env.DB.prepare('SELECT * FROM units WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'Unit tidak ditemukan' }, 404);
  const name = body.name || existing.name, fleet = body.fleet || existing.fleet, pit = body.pit || existing.pit;
  await env.DB.prepare('UPDATE units SET name=?, fleet=?, pit=? WHERE id=?').bind(name, fleet, pit, id).run();
  return json(await env.DB.prepare('SELECT * FROM units WHERE id = ?').bind(id).first());
}

async function handleDeleteUnit(env, id) {
  const existing = await env.DB.prepare('SELECT id FROM units WHERE id = ?').bind(id).first();
  if (!existing) return json({ error: 'Unit tidak ditemukan' }, 404);
  await env.DB.prepare('DELETE FROM units WHERE id = ?').bind(id).run();
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function handleShiftActive(env) {
  const s = await getActiveShift(env.DB);
  const now = new Date();
  const startH = Number(s.start.split(':')[0]);
  const endH = Number(s.end.split(':')[0]);
  return json({
    id: s.id, name: s.name, start: s.start, end: s.end,
    serverTime: now.toISOString(), currentHour: now.getUTCHours(),
    startHour: startH, endHour: endH === 0 ? 24 : endH
  });
}

async function handleShiftList(env) {
  return json(await getAllShifts(env.DB));
}

async function handleCreateRitasi(req, env, user) {
  const body = await req.json().catch(() => ({}));
  const { unitId, material, jam } = body;
  const unit = await env.DB.prepare('SELECT * FROM units WHERE id = ?').bind(unitId).first();
  if (!unit) return json({ error: 'Pilih unit terlebih dahulu / unit tidak ditemukan' }, 400);
  if (MATERIALS.indexOf(material) === -1) return json({ error: `Material tidak dikenal: ${material}` }, 400);

  const shift = await getActiveShift(env.DB);
  const now = new Date();
  const currentHour = now.getUTCHours();
  const jamValue = jam && jam !== 'auto' ? String(jam).padStart(2, '0') : String(currentHour).padStart(2, '0');
  if (Number(jamValue) > currentHour) return json({ error: 'Jam ritasi belum terjadi, tidak bisa dipilih' }, 400);

  const result = await env.DB.prepare(
    'INSERT INTO ritasi_log (unit_id, material, shift_id, jam, user_id, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(unit.id, material, shift.id, jamValue, user.id, todayStr(), now.toISOString()).run();

  return json({
    id: result.meta.last_row_id, unitId: unit.id, unitName: unit.name, material, shiftId: shift.id,
    jam: jamValue, userId: user.id, date: todayStr(), createdAt: now.toISOString()
  }, 201);
}

async function handleRitasiMe(env, user) {
  const result = await env.DB.prepare(
    `SELECT r.*, u.name as unitName FROM ritasi_log r JOIN units u ON u.id = r.unit_id
     WHERE r.user_id = ? AND r.date = ? ORDER BY r.created_at DESC`
  ).bind(user.id, todayStr()).all();
  return json(result.results);
}

async function handleRitasiList(req, env) {
  const url = new URL(req.url);
  const unit = url.searchParams.get('unit');
  const material = url.searchParams.get('material');
  let query = 'SELECT * FROM ritasi_log WHERE date = ?';
  const params = [todayStr()];
  if (unit) { query += ' AND unit_id = ?'; params.push(unit); }
  if (material) { query += ' AND material = ?'; params.push(material); }
  const result = await env.DB.prepare(query).bind(...params).all();
  return json(result.results);
}

async function handleRekap(req, env) {
  const url = new URL(req.url);
  const shift = await resolveShift(env.DB, url.searchParams.get('shift'));
  const units = (await env.DB.prepare('SELECT * FROM units ORDER BY name').all()).results;
  const logs = (await env.DB.prepare('SELECT * FROM ritasi_log WHERE date = ? AND shift_id = ?').bind(todayStr(), shift.id).all()).results;
  const rows = units.map((u) => {
    const unitLogs = logs.filter((l) => l.unit_id === u.id);
    const ob = unitLogs.filter((l) => l.material === 'OB').length;
    const coal = unitLogs.filter((l) => l.material === 'COAL').length;
    return { unitId: u.id, name: u.name, fleet: u.fleet, pit: u.pit, ob, coal, others: unitLogs.length - ob - coal, total: unitLogs.length };
  });
  return json({ shift, rows });
}

async function handleStatsToday(env) {
  const logs = (await env.DB.prepare('SELECT * FROM ritasi_log WHERE date = ?').bind(todayStr()).all()).results;
  const units = (await env.DB.prepare('SELECT * FROM units').all()).results;
  const totalRitasi = logs.length;
  const unitAktifSet = new Set(logs.map((l) => l.unit_id));
  const fleetAktifSet = new Set(logs.map((l) => units.find((u) => u.id === l.unit_id)).filter(Boolean).map((u) => u.fleet));
  const totalFleet = new Set(units.map((u) => u.fleet)).size;
  const trendPct = totalRitasi > 0 ? Math.round((unitAktifSet.size / Math.max(units.length, 1)) * 100) : 0;
  return json({ totalRitasiHariIni: totalRitasi, unitAktif: unitAktifSet.size, totalUnit: units.length, fleetAktif: fleetAktifSet.size, totalFleet, trendPct });
}

async function handleMaterialsSummary(req, env) {
  const url = new URL(req.url);
  const shift = await resolveShift(env.DB, url.searchParams.get('shift'));
  const logs = (await env.DB.prepare('SELECT material FROM ritasi_log WHERE date = ? AND shift_id = ?').bind(todayStr(), shift.id).all()).results;
  const summary = MATERIALS.map((m) => ({ material: m, count: logs.filter((l) => l.material === m).length }));
  return json(summary);
}

function csvEscape(val) {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function handleExport(req, env) {
  const url = new URL(req.url);
  const shift = await resolveShift(env.DB, url.searchParams.get('shift'));
  const units = (await env.DB.prepare('SELECT * FROM units ORDER BY name').all()).results;
  const logs = (await env.DB.prepare('SELECT * FROM ritasi_log WHERE date = ? AND shift_id = ?').bind(todayStr(), shift.id).all()).results;
  const rows = [['Unit', 'Fleet', 'PIT', 'OB', 'COAL', 'Total']];
  units.forEach((u) => {
    const unitLogs = logs.filter((l) => l.unit_id === u.id);
    const ob = unitLogs.filter((l) => l.material === 'OB').length;
    const coal = unitLogs.filter((l) => l.material === 'COAL').length;
    rows.push([u.name, u.fleet, u.pit, ob, coal, unitLogs.length]);
  });
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const filename = `rekap-${shift.name.replace(/\s+/g, '_')}-${todayStr()}.csv`;
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, ...corsHeaders() }
  });
}

// ===================== ROUTER =====================
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path === '/api/health') return json({ ok: true, time: new Date().toISOString() });

      if (path === '/api/auth/login' && method === 'POST') return handleLogin(request, env);
      if (path === '/api/auth/me' && method === 'GET') {
        const { user, error } = await requireAuth(request, env);
        if (error) return error;
        return handleMe(user);
      }

      if (path === '/api/units' && method === 'GET') return handleGetUnits(env);
      if (path === '/api/units' && method === 'POST') {
        const { error } = await requireAuth(request, env);
        if (error) return error;
        return handleCreateUnit(request, env);
      }
      const unitIdMatch = path.match(/^\/api\/units\/(\d+)$/);
      if (unitIdMatch && method === 'PUT') {
        const { error } = await requireAuth(request, env);
        if (error) return error;
        return handleUpdateUnit(request, env, unitIdMatch[1]);
      }
      if (unitIdMatch && method === 'DELETE') {
        const { error } = await requireAuth(request, env);
        if (error) return error;
        return handleDeleteUnit(env, unitIdMatch[1]);
      }

      if (path === '/api/shift/active' && method === 'GET') return handleShiftActive(env);
      if (path === '/api/shift' && method === 'GET') return handleShiftList(env);

      if (path === '/api/ritasi' && method === 'POST') {
        const { user, error } = await requireAuth(request, env);
        if (error) return error;
        return handleCreateRitasi(request, env, user);
      }
      if (path === '/api/ritasi/me' && method === 'GET') {
        const { user, error } = await requireAuth(request, env);
        if (error) return error;
        return handleRitasiMe(env, user);
      }
      if (path === '/api/ritasi' && method === 'GET') {
        const { error } = await requireAuth(request, env);
        if (error) return error;
        return handleRitasiList(request, env);
      }

      if (path === '/api/rekap' && method === 'GET') return handleRekap(request, env);
      if (path === '/api/stats/today' && method === 'GET') return handleStatsToday(env);
      if (path === '/api/materials/summary' && method === 'GET') return handleMaterialsSummary(request, env);
      if (path === '/api/export' && method === 'GET') return handleExport(request, env);

      return json({ error: `Route ${method} ${path} tidak ditemukan` }, 404);
    } catch (err) {
      return json({ error: err.message || 'Terjadi kesalahan pada server' }, 500);
    }
  }
};
