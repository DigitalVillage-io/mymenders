import crypto from 'node:crypto';
import { Pool } from 'pg';
import { activateVendor, safeParseMetadata, updateVendor, ValidationError } from './db.js';
import { normalizeTaxonomyValues } from '../../shared/vendorTaxonomy.js';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PAGE_SIZE = 25;
const COOKIE = 'mymenders_admin';
const secret = () => process.env.ADMIN_JWT_SECRET || '';
const secureCookie = () => process.env.NODE_ENV === 'production';

const b64 = (value) => Buffer.from(value).toString('base64url');
const sign = (input) => crypto.createHmac('sha256', secret()).update(input).digest('base64url');
export const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const verifyPassword = (password, stored) => {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  return actual.length === Buffer.from(hash, 'hex').length && crypto.timingSafeEqual(actual, Buffer.from(hash, 'hex'));
};
const createToken = (admin) => {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64(JSON.stringify({ sub: admin.id, username: admin.username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
};
const getCookie = (request) => (request.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
export const requireAdmin = async (request) => {
  if (!secret()) return null;
  const token = getCookie(request);
  if (!token) return null;
  const [header, payload, signature] = token.split('.');
  const expected = sign(`${header}.${payload}`);
  if (!header || !payload || !signature || Buffer.byteLength(signature) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decoded.exp < Date.now() / 1000) return null;
    return decoded;
  } catch { return null; }
};
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const parseBody = async (request) => request.json().catch(() => ({}));
const adminVendor = (row) => {
  const metadata = safeParseMetadata(row.photos);
  return {
    ...row,
    ...metadata,
    entry_level: metadata.entry_level || row.entry_level || row.category,
    types: normalizeTaxonomyValues('types', metadata.types || []),
    categories: normalizeTaxonomyValues('categories', metadata.categories || []),
    regional_techniques: normalizeTaxonomyValues('regional_techniques', metadata.regional_techniques || []),
    website: row.website || row.online_presence || metadata.online_presence || metadata.website || '',
    social: row.social || '',
    email: row.email || '',
    review_text: metadata.review_text || '',
    rating: metadata.rating ?? 0,
    rating_count: metadata.rating_count ?? 0,
    location_visibility: row.location_visibility === 'approx' ? 'approx' : 'exact',
  };
};

export async function handleAdminRequest(request, path) {
  const method = request.method;
  if (path === 'auth/login' && method === 'POST') {
    const { username, password } = await parseBody(request);
    const result = await pool.query('SELECT id, username, password_hash FROM admins WHERE username=$1', [username]);
    if (!result.rows[0] || !verifyPassword(password, result.rows[0].password_hash)) return json({ error: 'Invalid credentials' }, 401);
    return json({ username: result.rows[0].username }, 200, { 'Set-Cookie': `${COOKIE}=${createToken(result.rows[0])}; HttpOnly;${secureCookie() ? ' Secure;' : ''} SameSite=Strict; Path=/; Max-Age=43200` });
  }
  if (path === 'auth/logout' && method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; HttpOnly;${secureCookie() ? ' Secure;' : ''} SameSite=Strict; Path=/; Max-Age=0` });
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Unauthorized' }, 401);
  if (path === 'auth/me' && method === 'GET') return json({ username: admin.username });
  if (path === 'menders' && method === 'GET') {
    const params = new URL(request.url).searchParams;
    const requestedPage = Number(params.get('page') || 1);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const search = (params.get('q') || '').trim();
    const status = params.get('status') || 'all';
    if (!['all', 'active', 'draft', 'none'].includes(status)) return json({ error: 'Invalid status filter' }, 400);
    const searchPattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const filter = `is_deleted = false
      AND ($1 = '' OR name ILIKE $2 ESCAPE '\\' OR address ILIKE $2 ESCAPE '\\' OR category ILIKE $2 ESCAPE '\\')
      AND ($3 = 'all' OR ($3 <> 'none' AND status = $3))`;
    const values = [search, searchPattern, status];
    const [filtered, summary] = await Promise.all([
      pool.query(`SELECT count(*)::int AS total FROM vendors WHERE ${filter}`, values),
      pool.query(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE status = 'active')::int AS active,
        count(*) FILTER (WHERE status = 'draft')::int AS draft
        FROM vendors WHERE is_deleted = false`),
    ]);
    const total = filtered.rows[0].total;
    const effectivePage = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
    const result = await pool.query(
      `SELECT * FROM vendors WHERE ${filter}
       ORDER BY CASE WHEN status = 'draft' THEN 0 ELSE 1 END, id
       LIMIT $4 OFFSET $5`,
      [...values, PAGE_SIZE, (effectivePage - 1) * PAGE_SIZE],
    );
    return json({ items: result.rows.map(adminVendor), total, page: effectivePage, pageSize: PAGE_SIZE, summary: summary.rows[0] });
  }
  const match = path.match(/^menders\/(\d+)(\/activate)?$/);
  if (match && method === 'GET') {
    const result = await pool.query('SELECT * FROM vendors WHERE id=$1 AND is_deleted = false', [Number(match[1])]);
    return result.rows[0] ? json(adminVendor(result.rows[0])) : json({ error: 'Mender not found' }, 404);
  }
  if (match && method === 'PATCH' && !match[2]) {
    try { return json(adminVendor(await updateVendor(pool, match[1], await parseBody(request)))); }
    catch (error) { return json({ error: error.message }, error instanceof ValidationError && error.message === 'Mender not found' ? 404 : 400); }
  }
  if (match && method === 'POST' && match[2]) {
    try { return json(adminVendor(await activateVendor(pool, match[1]))); }
    catch (error) { return json({ error: error.message }, 404); }
  }
  if (match && method === 'DELETE' && !match[2]) {
    const result = await pool.query('UPDATE vendors SET is_deleted = true WHERE id=$1 AND is_deleted = false RETURNING id', [Number(match[1])]);
    return result.rows[0] ? json({ ok: true }) : json({ error: 'Mender not found' }, 404);
  }
  return json({ error: 'Not found' }, 404);
}

export { COOKIE };
