// Production server for self-hosting (pm2 + Caddy). Mirrors the Vercel setup:
// serves the Vite build from dist/ with SPA fallback and mounts the API routes.
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAdminRequest, pool } from './api/lib/admin.js';
import { insertEmailSub, insertVendor, updateVendorAddress, ValidationError } from './api/lib/db.js';

const PORT = Number(process.env.PORT) || 3003;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const handleApiError = (err, fallbackMessage, notFoundStatus = 400) => {
  if (err instanceof ValidationError) {
    return json({ error: err.message }, err.message === 'Vendor not found' ? notFoundStatus : 400);
  }
  console.error(`${fallbackMessage}:`, err);
  return json({ error: fallbackMessage }, 500);
};

async function handleVendors(request) {
  try {
    if (request.method === 'GET') {
      const result = await pool.query("SELECT * FROM vendors WHERE status = 'active' ORDER BY id");
      return json(result.rows);
    }
    if (request.method === 'POST') return json(await insertVendor(pool, await request.json()), 201);
    if (request.method === 'PATCH') return json(await updateVendorAddress(pool, await request.json()));
    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return handleApiError(err, 'Failed to handle vendors request', 404);
  }
}

async function handleSubscribe(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await request.json();
    return json(await insertEmailSub(pool, body.email), 201);
  } catch (err) {
    return handleApiError(err, 'Failed to subscribe');
  }
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

async function toWebRequest(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const hasBody = !['GET', 'HEAD'].includes(req.method || 'GET');
  return new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
    method: req.method,
    headers,
    body: hasBody ? await readBody(req) : undefined,
  });
}

async function sendWebResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    if (key !== 'set-cookie') headers[key] = value;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function routeApi(req, res, pathname) {
  let response;
  try {
    if (pathname === '/api/vendors') {
      response = await handleVendors(await toWebRequest(req));
    } else if (pathname === '/api/subscribe') {
      response = await handleSubscribe(await toWebRequest(req));
    } else if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
      const adminPath = pathname.replace(/^\/api\/admin\/?/, '').replace(/\/$/, '');
      response = await handleAdminRequest(await toWebRequest(req), adminPath);
    } else {
      response = json({ error: 'Not found' }, 404);
    }
  } catch (err) {
    if (err.status === 413) {
      response = json({ error: err.message }, 413);
    } else {
      console.error(`Unhandled API error for ${req.method} ${pathname}:`, err);
      response = json({ error: 'Internal server error' }, 500);
    }
  }
  if (!res.headersSent) await sendWebResponse(res, response);
}

async function serveFile(req, res, filePath, cacheControl) {
  const info = await stat(filePath);
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': cacheControl,
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(filePath).pipe(res);
}

async function routeStatic(req, res, pathname) {
  if (!['GET', 'HEAD'].includes(req.method || '')) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  const filePath = path.join(DIST_DIR, path.normalize(pathname));
  if (filePath.startsWith(DIST_DIR + path.sep)) {
    try {
      if ((await stat(filePath)).isFile()) {
        // Vite emits content-hashed files under /assets, so they can be cached forever.
        const cacheControl = pathname.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600';
        return await serveFile(req, res, filePath, cacheControl);
      }
    } catch {
      // Not a file on disk: fall through to the SPA entry point.
    }
  }

  await serveFile(req, res, path.join(DIST_DIR, 'index.html'), 'no-cache');
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }

  try {
    if (pathname === '/api' || pathname.startsWith('/api/')) return await routeApi(req, res, pathname);
    return await routeStatic(req, res, pathname);
  } catch (err) {
    console.error(`Request failed for ${req.method} ${pathname}:`, err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});

if (!existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.error(`FATAL: ${DIST_DIR}/index.html not found. Run 'npm run build' before starting the server.`);
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`mymenders listening on http://${HOST}:${PORT}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
