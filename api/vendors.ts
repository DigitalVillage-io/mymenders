import { Pool } from 'pg';
import { insertVendor, publicVendor, ValidationError } from './lib/db.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await pool.query("SELECT * FROM vendors WHERE status = 'active' AND is_deleted = false ORDER BY id");
    return new Response(JSON.stringify(result.rows.map(publicVendor)), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error fetching vendors:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch vendors' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const vendor = await insertVendor(pool, body);

    return new Response(JSON.stringify(publicVendor(vendor)), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Error creating vendor:', err);
    return new Response(JSON.stringify({ error: 'Failed to create vendor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Location updates are intentionally admin-only. The former unauthenticated
// PATCH accepted an id and could rewrite a public record's address.
