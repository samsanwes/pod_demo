#!/usr/bin/env node
// Direct-Postgres migration runner.
// Uses pg + the pooler connection string so we don't need the Supabase CLI.
//
// Usage: node scripts/run-migrations.mjs [--seed]

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Client } from 'pg';

const ref = process.env.SUPABASE_REF || 'oqnuwhjwioexazkmnyog';
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('SUPABASE_DB_PASSWORD env var is required');
  process.exit(1);
}

// Supabase transaction-pooler (port 6543) works from any IPv4 network; the direct
// db.<ref>.supabase.co:5432 endpoint is IPv6-only on the free tier.
const connString = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const args = process.argv.slice(2);
const runSeed = args.includes('--seed');
const migrationsDir = path.resolve('supabase/migrations');

async function main() {
  const client = new Client({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`✓ Connected to Supabase (ref: ${ref})`);

  // Track applied migrations
  await client.query(`
    CREATE TABLE IF NOT EXISTS public._pod_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows: applied } = await client.query('SELECT filename FROM public._pod_migrations');
  const appliedSet = new Set(applied.map((r) => r.filename));

  for (const f of files) {
    if (appliedSet.has(f)) {
      console.log(`  ⊙ ${f} (already applied, skipping)`);
      continue;
    }
    const sql = await fs.readFile(path.join(migrationsDir, f), 'utf8');
    process.stdout.write(`  → ${f} ... `);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO public._pod_migrations (filename) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log('✓');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`✗\n    ${err.message}`);
      throw err;
    }
  }

  if (runSeed) {
    const seedPath = path.resolve('supabase/seed.sql');
    const seed = await fs.readFile(seedPath, 'utf8');
    process.stdout.write('  → seed.sql ... ');
    try {
      await client.query(seed);
      console.log('✓');
    } catch (err) {
      console.error(`✗\n    ${err.message}`);
      throw err;
    }
  }

  await client.end();
  console.log('\n✓ Done.');
}

main().catch((err) => {
  console.error('\n✗ Migration failed:', err.message);
  process.exit(1);
});
