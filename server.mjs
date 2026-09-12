import http from 'node:http';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
try {
  for (const line of (await readFile(resolve(root, '.env'), 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!process.env.ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD in .env before starting.');
const passwordHash = createHash('sha256').update(process.env.ADMIN_PASSWORD).digest();
const dataFile = process.env.CHAT_DATA_FILE || resolve(root, 'data/chats.json');
const publicDir = resolve(root, 'dist');
const sessions = new Map();
const attempts = new Map();
const ttl = 8 * 60 * 60 * 1000;
let writing = false;
const animations = ['none', 'fade', 'bounce', 'pulse', 'wave'];

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.test(value)) return false;
  const full = value.length === 7 ? `${value}-01` : value;
  const date = new Date(`${full}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === full;
}
function validate(data) {
  if (!data || !Number.isInteger(data.revision) || !Array.isArray(data.groups) || data.groups.length > 100) return false;
  const ids = new Set();
  return data.groups.every(group => {
    if (!group || typeof group.id !== 'string' || !/^[\w-]{1,80}$/.test(group.id) || ids.has(group.id) || !validDate(group.date) || typeof group.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(group.time)) return false;
    ids.add(group.id);
    return Array.isArray(group.messages) && group.messages.length > 0 && group.messages.length <= 30 && group.messages.every(message =>
      message && typeof message.text === 'string' && message.text.trim().length > 0 && message.text.length <= 3000 &&
      typeof message.reaction === 'string' && message.reaction.length <= 32 && animations.includes(message.animation));
  });
}
function send(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function body(req) {
  let value = '';
  for await (const part of req) {
    value += part;
    if (Buffer.byteLength(value) > 1024 * 1024) throw Object.assign(new Error('Request too large'), { status: 413 });
  }
  try { return JSON.parse(value); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
function token(req) { return req.headers.cookie?.match(/(?:^|;\s*)portfolio_session=([a-f0-9]{64})(?:;|$)/)?.[1]; }
function authenticated(req) {
  const key = token(req);
  const expiry = sessions.get(key);
  if (expiry > Date.now()) return true;
  if (key) sessions.delete(key);
  return false;
}
function cookie(req, value, maxAge) {
  const secure = req.socket.encrypted ? '; Secure' : '';
  return `portfolio_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src https://maps.google.com https://www.google.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const expectedOrigin = `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
      if (req.headers.origin !== expectedOrigin || req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, { error: 'Request origin is not allowed.' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(res, 415, { error: 'JSON is required.' });
    }
    if (path === '/api/login' && req.method === 'POST') {
      const address = req.socket.remoteAddress;
      const previous = attempts.get(address);
      const record = previous?.until > Date.now() ? previous : { count: 0, until: Date.now() + 60000 };
      attempts.set(address, record);
      if (++record.count > 10) return send(res, 429, { error: 'Too many attempts. Try again in a minute.' });
      const input = await body(req);
      const hash = createHash('sha256').update(typeof input?.password === 'string' ? input.password : '').digest();
      if (!timingSafeEqual(hash, passwordHash)) return send(res, 401, { error: 'Incorrect password.' });
      const key = randomBytes(32).toString('hex');
      sessions.set(key, Date.now() + ttl);
      attempts.delete(address);
      res.setHeader('Set-Cookie', cookie(req, key, ttl / 1000));
      return send(res, 200, { ok: true });
    }
    if (path === '/api/session' && req.method === 'GET') return send(res, 200, { authenticated: authenticated(req) });
    if (path === '/api/logout' && req.method === 'POST') {
      sessions.delete(token(req));
      res.setHeader('Set-Cookie', cookie(req, '', 0));
      return send(res, 200, { ok: true });
    }
    if (path === '/api/chats' && req.method === 'GET') return send(res, 200, JSON.parse(await readFile(dataFile, 'utf8')));
    if (path === '/api/chats' && req.method === 'PUT') {
      if (!authenticated(req)) return send(res, 401, { error: 'Please sign in again. Your unsaved edits are still here.' });
      const input = await body(req);
      if (!validate(input)) return send(res, 400, { error: 'Check dates, message text, reactions, and animation choices.' });
      if (writing) return send(res, 409, { error: 'Another save is in progress. Try again.' });
      writing = true;
      try {
        const current = JSON.parse(await readFile(dataFile, 'utf8'));
        if (current.revision !== input.revision) return send(res, 409, { error: 'The timeline was changed in another session. Reload before saving.' });
        const saved = { revision: current.revision + 1, groups: input.groups.map(g => ({ id: g.id, date: g.date, time: g.time, messages: g.messages.map(m => ({ text: m.text.trim(), reaction: m.reaction.trim(), animation: m.animation })) })).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)) };
        await writeFile(`${dataFile}.tmp`, JSON.stringify(saved, null, 2) + '\n', 'utf8');
        await rename(`${dataFile}.tmp`, dataFile);
        return send(res, 200, saved);
      } finally { writing = false; }
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Method not allowed.' });
    const requested = path === '/' ? 'index.html' : ['/admins', '/admins/'].includes(path) ? 'admins.html' : decodeURIComponent(path).slice(1);
    const file = resolve(publicDir, requested);
    if (!file.startsWith(publicDir + sep) || requested.split(/[\\/]/).some(segment => segment.startsWith('.'))) return send(res, 404, { error: 'Not found.' });
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
    if (!types[extname(file)]) return send(res, 404, { error: 'Not found.' });
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    send(res, error.code === 'ENOENT' ? 404 : error.status || 500, { error: error.code === 'ENOENT' ? 'Not found.' : error.status ? error.message : 'Could not complete the request. Please try again.' });
  }
});
setInterval(() => {
  for (const [key, expiry] of sessions) if (expiry < Date.now()) sessions.delete(key);
  for (const [key, record] of attempts) if (record.until < Date.now()) attempts.delete(key);
}, 60000).unref();
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`Portfolio: http://localhost:${server.address().port}\nAdmin: http://localhost:${server.address().port}/admins`));
