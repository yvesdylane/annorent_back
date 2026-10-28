import type { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

export async function seedAdmin(pool: Pool): Promise<void> {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmails.length === 0 || !adminPassword) {
    return;
  }

  const client = await pool.connect();
  try {
    for (const email of adminEmails) {
      const existing = await client.query('SELECT user_id FROM public.users WHERE lower(email) = lower($1)', [email]);
      if (existing.rows[0]) {
        await client.query(`UPDATE public.users SET role = 'admin', kyc_status = 'verified', updated_at = now() WHERE user_id = $1`, [existing.rows[0].user_id]);
        continue;
      }
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await client.query(
        `INSERT INTO public.users (name, email, password_hash, role, kyc_status)
         VALUES ($1, $2, $3, 'admin', 'verified')`,
        ['Admin', email, passwordHash],
      );
      console.log(`[Bootstrap] Created admin user ${email}`);
    }
  } finally {
    client.release();
  }
}
