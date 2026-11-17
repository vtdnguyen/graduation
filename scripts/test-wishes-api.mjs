import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../server/worker.ts';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_wishes.sql', import.meta.url), 'utf8'));
  const env = {
    WISHES_DB: { prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return db.prepare(sql).get(...values) ?? null; },
        async all() { return { results: db.prepare(sql).all(...values) }; },
        async run() { return { meta: db.prepare(sql).run(...values) }; },
      };
    } },
    ASSETS: { fetch: async () => new Response('asset') },
  };
  const call = (body, headers = {}, query = '') => worker.fetch(new Request(`https://example.com/grad/api/wishes${query}`, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com', 'CF-Connecting-IP': '192.0.2.1', ...headers }, body: JSON.stringify(body),
  }), env);
  return { call, db, env };
}
const payload = { id: 'a'.repeat(32), name: '  Minh Anh  ', message: 'Chúc Nguyên tốt nghiệp vui vẻ! 💚\nHẹn gặp ở buổi lễ.' };

test('durable insert, safe public fields, retry without duplicates, and rate limit', async () => {
  const { call, db } = fixture();
  assert.equal((await call(payload)).status, 201);
  assert.equal((await call(payload)).status, 200);
  assert.equal((await call({ ...payload, message: 'Changed' })).status, 409);
  assert.equal((await call({ ...payload, id: 'b'.repeat(32) })).status, 429);
  const data = await (await call()).json();
  assert.equal(data.wishes.length, 1);
  assert.equal(data.wishes[0].name, 'Minh Anh');
  assert.equal(data.wishes[0].message, payload.message);
  assert.equal('sender_hash' in data.wishes[0], false);
  assert.equal(data.next, null);
  db.close();
});

test('reject blank/oversized/invalid fields, large bodies, and cross-origin submissions', async () => {
  const { call, db } = fixture();
  for (const body of [null, {}, { ...payload, name: ' ' }, { ...payload, message: '\n  ' }, { ...payload, name: 'a'.repeat(61) }, { ...payload, message: 'x'.repeat(601) }, { ...payload, id: '<script>' }, { ...payload, message: 'x'.repeat(9000) }]) {
    assert.equal((await call(body)).status, 400);
  }
  assert.equal((await call(payload, { Origin: 'https://unrelated.example' })).status, 403);
  assert.equal((await call(payload, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await call(undefined, {}, '?before=bad')).status, 400);
  assert.equal((await (await call()).json()).wishes.length, 0);
  db.close();
});

test('pagination has no gaps or repeats when new wishes arrive', async () => {
  const { call, db } = fixture();
  for (let i = 1; i <= 25; i++) {
    assert.equal((await call({ ...payload, id: i.toString(16).padStart(32, '0') }, { 'CF-Connecting-IP': `192.0.2.${i}` })).status, 201);
  }
  const first = await (await call()).json();
  assert.equal(first.wishes.length, 20);
  await call({ ...payload, id: 'f'.repeat(32) }, { 'CF-Connecting-IP': '192.0.2.99' });
  const second = await (await call(undefined, {}, `?before=${first.next}`)).json();
  assert.equal(second.wishes.length, 5);
  assert.equal(new Set([...first.wishes, ...second.wishes].map((w) => w.id)).size, 25);
  assert.equal(second.next, null);
  db.close();
});
