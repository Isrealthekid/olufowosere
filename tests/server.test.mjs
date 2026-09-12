import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('authenticated editing persists, rejects stale and invalid saves, and keeps secrets private', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'portfolio-test-'));
  const dataFile = join(temp, 'chats.json');
  await copyFile(new URL('../data/chats.json', import.meta.url), dataFile);
  const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', ADMIN_PASSWORD: 'test-only-password', CHAT_DATA_FILE: dataFile }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.stdout.on('data', chunk => { const match = chunk.toString().match(/http:\/\/localhost:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
    });
    let cookie = '';
    const request = (path, method = 'GET', data, origin = base) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie }, body: data === undefined ? undefined : JSON.stringify(data) });
    assert.equal((await request('/admins')).status, 200);
    assert.equal((await request('/.env')).status, 404);
    assert.equal((await request('/data/chats.json')).status, 404);
    const original = await (await request('/api/chats')).json();
    assert.equal(original.groups.find(g => g.id === 'papyrus').date, '2025-05-20');
    assert.equal(original.groups.find(g => g.id === 'nysc').date, '2025-04-25');
    assert.equal((await request('/api/chats', 'PUT', original)).status, 401);
    assert.equal((await request('/api/login', 'POST', { password: 'wrong' })).status, 401);
    const login = await request('/api/login', 'POST', { password: 'test-only-password' });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await (await request('/api/session')).json()).authenticated, true);
    assert.equal((await request('/api/chats', 'PUT', original, 'https://unrelated.example')).status, 403);
    const bad = structuredClone(original); bad.groups[0].date = '2024-02-31';
    assert.equal((await request('/api/chats', 'PUT', bad)).status, 400);
    bad.groups[0].date = '2024-02-29'; bad.groups[0].messages[0].animation = 'unknown';
    assert.equal((await request('/api/chats', 'PUT', bad)).status, 400);
    const invalidTime = structuredClone(original); invalidTime.groups[0].time = '25:61';
    assert.equal((await request('/api/chats', 'PUT', invalidTime)).status, 400);
    const edited = structuredClone(original); edited.groups[0].time = '19:51'; edited.groups[0].messages[0] = { text: 'Updated message', reaction: '✨', animation: 'bounce' };
    const save = await request('/api/chats', 'PUT', edited); assert.equal(save.status, 200);
    const saved = await save.json();
    assert.equal(saved.revision, original.revision + 1);
    assert.equal(saved.groups[0].time, '19:51');
    assert.deepEqual(JSON.parse(await readFile(dataFile, 'utf8')), saved);
    assert.deepEqual(await (await request('/api/chats')).json(), saved);
    assert.equal((await request('/api/chats', 'PUT', original)).status, 409);
    assert.equal((await request('/api/logout', 'POST', {})).status, 200);
    assert.equal((await request('/api/chats', 'PUT', saved)).status, 401);
  } finally {
    const exited = once(child, 'exit'); child.kill(); await exited;
    await rm(temp, { recursive: true, force: true });
  }
});
