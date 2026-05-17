import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { ApiConfig } from './config.js';
import type { DbPool } from './db.js';
import { validateShareSnapshot } from './validation.js';

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

function sendJson(res: ServerResponse, status: number, body: JsonValue, headers: Record<string, string> = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data).toString(),
    ...headers,
  });
  res.end(data);
}

function corsHeaders(req: IncomingMessage, config: ApiConfig): Record<string, string> {
  const origin = req.headers.origin;
  if (!origin) return {};
  const allowed = config.corsOrigins.includes('*') || config.corsOrigins.includes(origin);
  if (!allowed) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,x-delete-token',
    'vary': 'Origin',
  };
}

function readBody(req: IncomingMessage, maxBytes: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('REQUEST_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function hashSnapshot(snapshot: { createdAt?: unknown }) {
  const { createdAt: _createdAt, ...hashableSnapshot } = snapshot;
  return createHash('sha256').update(JSON.stringify(hashableSnapshot)).digest('hex');
}

function safeEqualHash(a: string, b: string) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

function createId() {
  return randomBytes(12).toString('base64url');
}

function createDeleteToken() {
  return randomBytes(24).toString('base64url');
}

function isValidId(id: string) {
  return /^[A-Za-z0-9_-]{8,32}$/.test(id);
}

function expiresAtFor(config: ApiConfig) {
  if (config.shareDefaultTtlDays <= 0) return null;
  return new Date(Date.now() + config.shareDefaultTtlDays * 24 * 60 * 60 * 1000);
}

async function createShare(req: IncomingMessage, res: ServerResponse, config: ApiConfig, db: DbPool, headers: Record<string, string>) {
  let body: Buffer;
  try {
    body = await readBody(req, config.maxShareBytes);
  } catch (error) {
    if (error instanceof Error && error.message === 'REQUEST_TOO_LARGE') {
      sendJson(res, 413, { error: 'share payload is too large' }, headers);
      return;
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    sendJson(res, 400, { error: 'invalid JSON body' }, headers);
    return;
  }

  const validated = validateShareSnapshot(parsed);
  if (!validated.ok) {
    sendJson(res, 422, { error: 'invalid share snapshot', details: validated.errors }, headers);
    return;
  }

  const deleteToken = createDeleteToken();
  const deleteTokenHash = hashToken(deleteToken);
  const snapshotHash = hashSnapshot(validated.value);
  const expiresAt = expiresAtFor(config);

  const [existingRows] = await db.execute(
    `SELECT id, delete_token_hash, deleted_at
       FROM share_snapshots
      WHERE snapshot_hash = :snapshotHash
      ORDER BY created_at ASC
      LIMIT 1`,
    { snapshotHash },
  );
  const existing = (existingRows as Array<{ id: string; delete_token_hash: string | null; deleted_at: Date | string | null }>)[0];
  if (existing) {
    if (existing.deleted_at) {
      await db.execute(
        `UPDATE share_snapshots
            SET deleted_at = NULL,
                expires_at = :expiresAt,
                delete_token_hash = :deleteTokenHash
          WHERE id = :id`,
        {
          id: existing.id,
          expiresAt,
          deleteTokenHash,
        },
      );
      sendJson(res, 201, {
        id: existing.id,
        url: `${config.publicSiteUrl}/share/${existing.id}`,
        deleteToken,
        restored: true,
      }, headers);
      return;
    }

    await db.execute(
      `UPDATE share_snapshots
          SET delete_token_hash = :deleteTokenHash
        WHERE id = :id`,
      {
        id: existing.id,
        deleteTokenHash,
      },
    );

    sendJson(res, 200, {
      id: existing.id,
      url: `${config.publicSiteUrl}/share/${existing.id}`,
      deleteToken,
      existing: true,
    }, headers);
    return;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const id = createId();
    try {
      await db.execute(
        `INSERT INTO share_snapshots
          (id, schema_version, snapshot_hash, payload, expires_at, delete_token_hash)
         VALUES
          (:id, :schemaVersion, :snapshotHash, :payload, :expiresAt, :deleteTokenHash)`,
        {
          id,
          schemaVersion: validated.value.schemaVersion,
          snapshotHash,
          payload: JSON.stringify(validated.value),
          expiresAt,
          deleteTokenHash,
        },
      );

      sendJson(res, 201, {
        id,
        url: `${config.publicSiteUrl}/share/${id}`,
        deleteToken,
      }, headers);
      return;
    } catch (error: unknown) {
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
      if (code !== 'ER_DUP_ENTRY') throw error;
    }
  }

  sendJson(res, 500, { error: 'failed to allocate share id' }, headers);
}

async function getShare(id: string, res: ServerResponse, db: DbPool, headers: Record<string, string>) {
  if (!isValidId(id)) {
    sendJson(res, 404, { error: 'share not found' }, headers);
    return;
  }

  const [rows] = await db.execute(
    `SELECT payload
      FROM share_snapshots
      WHERE id = :id
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    { id },
  );
  const items = rows as Array<{ payload: unknown }>;
  if (!items.length) {
    sendJson(res, 404, { error: 'share not found' }, headers);
    return;
  }

  void db.execute('UPDATE share_snapshots SET view_count = view_count + 1 WHERE id = :id', { id });
  sendJson(res, 200, { id, snapshot: items[0].payload }, headers);
}

async function deleteShare(id: string, url: URL, req: IncomingMessage, res: ServerResponse, db: DbPool, headers: Record<string, string>) {
  if (!isValidId(id)) {
    sendJson(res, 404, { error: 'share not found' }, headers);
    return;
  }

  const token = req.headers['x-delete-token'] || url.searchParams.get('token');
  const tokenValue = Array.isArray(token) ? token[0] : token;
  if (!tokenValue) {
    sendJson(res, 401, { error: 'delete token is required' }, headers);
    return;
  }

  const [rows] = await db.execute(
    'SELECT delete_token_hash FROM share_snapshots WHERE id = :id AND deleted_at IS NULL LIMIT 1',
    { id },
  );
  const items = rows as Array<{ delete_token_hash: string | null }>;
  if (!items.length || !items[0].delete_token_hash) {
    sendJson(res, 404, { error: 'share not found' }, headers);
    return;
  }

  if (!safeEqualHash(hashToken(tokenValue), items[0].delete_token_hash)) {
    sendJson(res, 403, { error: 'delete token is invalid' }, headers);
    return;
  }

  await db.execute('UPDATE share_snapshots SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL', { id });
  sendJson(res, 200, { ok: true }, headers);
}

export function createServer(config: ApiConfig, db: DbPool) {
  return http.createServer(async (req, res) => {
    const headers = corsHeaders(req, config);

    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';

      if (req.method === 'GET' && pathname === '/healthz') {
        sendJson(res, 200, { ok: true, uptime: process.uptime() }, headers);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/shares') {
        await createShare(req, res, config, db, headers);
        return;
      }

      const shareMatch = pathname.match(/^\/api\/shares\/([^/]+)$/);
      if (shareMatch && req.method === 'GET') {
        await getShare(shareMatch[1], res, db, headers);
        return;
      }

      if (shareMatch && req.method === 'DELETE') {
        await deleteShare(shareMatch[1], url, req, res, db, headers);
        return;
      }

      sendJson(res, 404, { error: 'not found' }, headers);
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: 'internal server error' }, headers);
    }
  });
}
