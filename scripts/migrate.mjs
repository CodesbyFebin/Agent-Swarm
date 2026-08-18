import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;
const sql = await readFile(new URL('../infra/migrations/001_init.sql', import.meta.url), 'utf8');
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  console.log('Migration 001_init.sql applied');
} finally {
  await client.end();
}
