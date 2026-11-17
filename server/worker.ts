/** API dùng chung cho khách mời; dữ liệu giữ trong Cloudflare D1. */
interface Statement {
  bind(...values: (string | number)[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
interface Env {
  WISHES_DB: { prepare(sql: string): Statement };
  ASSETS: { fetch(request: Request): Promise<Response> };
}
type Row = { seq: number; id: string; name: string; message: string; created_at: number };
const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const decoder = new TextDecoder();
  let text = '', bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) { await reader.cancel(); throw new Error('body'); }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode()) as unknown;
}

async function wishes(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === 'GET') {
    const raw = url.searchParams.get('before');
    const before = raw === null ? Number.MAX_SAFE_INTEGER : Number(raw);
    if (!Number.isSafeInteger(before) || before <= 0) return json({ error: 'cursor' }, 400);
    const { results } = await env.WISHES_DB.prepare('SELECT seq, id, name, message, created_at FROM wishes WHERE seq < ? ORDER BY seq DESC LIMIT 21').bind(before).all<Row>();
    const page = results.slice(0, 20);
    return json({ wishes: page.map(({ seq: _seq, ...row }) => row), next: results.length > 20 ? page.at(-1)!.seq : null });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  // Chỉ nhận JSON cùng origin, tránh form từ website khác gửi lời chúc thay khách.
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return json({ error: 'origin' }, 403);
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ error: 'origin' }, 403);
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: 'content-type' }, 415);
  let body: unknown;
  try { body = await readBody(request); } catch { return json({ error: 'body' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'body' }, 400);
  const { id, name: rawName, message: rawMessage } = body as Record<string, unknown>;
  if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id) || typeof rawName !== 'string' || typeof rawMessage !== 'string') return json({ error: 'fields' }, 400);
  const name = rawName.trim().replace(/\s+/g, ' ');
  const message = rawMessage.trim();
  if (!name || name.length > 60 || !message || message.length > 600 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(name + message)) return json({ error: 'fields' }, 400);
  // Cùng ID + nội dung khi thử lại sau mất mạng không sinh thư trùng.
  const existing = await env.WISHES_DB.prepare('SELECT name, message FROM wishes WHERE id = ?').bind(id).first<{ name: string; message: string }>();
  if (existing) return existing.name === name && existing.message === message ? json({ ok: true }) : json({ error: 'conflict' }, 409);
  const now = Date.now();
  // Không lưu địa chỉ IP; hash đổi theo ngày, chỉ dùng để hạn chế gửi liên tiếp.
  const source = `${Math.floor(now / 86400000)}:${request.headers.get('CF-Connecting-IP') ?? 'local'}`;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const sender = [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('');
  const result = await env.WISHES_DB.prepare(`INSERT OR IGNORE INTO wishes (id, name, message, created_at, sender_hash)
    SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM wishes WHERE sender_hash = ? AND created_at > ?)`)
    .bind(id, name, message, now, sender, sender, now - 10000).run();
  if (!result.meta.changes) {
    const duplicate = await env.WISHES_DB.prepare('SELECT name, message FROM wishes WHERE id = ?').bind(id).first<{ name: string; message: string }>();
    if (duplicate?.name === name && duplicate.message === message) return json({ ok: true });
    return json({ error: 'rate-limit' }, 429);
  }
  return json({ ok: true }, 201);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/grad/api/wishes') {
      try { return await wishes(request, env, url); }
      catch (error) { console.error('Wishes storage unavailable', error); return json({ error: 'unavailable' }, 503); }
    }
    if (url.pathname.startsWith('/grad/api/')) return json({ error: 'not-found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
