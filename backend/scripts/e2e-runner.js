/**
 * Self-contained E2E runner — starts embedded PostgreSQL, seeds DB,
 * launches the API, and runs the workflow test (no Docker required).
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import EmbeddedPostgres from 'embedded-postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PG_DIR = path.join(ROOT, '.pg-e2e');
const PORT = 5001;
const API = `http://localhost:${PORT}/api`;

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

async function waitForHealth(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${API}/health`);
      if (res.ok) return;
    } catch {
      /* server still starting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API server did not become healthy in time');
}

async function main() {
  console.log('\nEduAdmit E2E Runner (embedded PostgreSQL)\n');

  const pg = new EmbeddedPostgres({
    databaseDir: PG_DIR,
    user: 'eduadmit',
    password: 'eduadmit123',
    port: 5433,
    persistent: false,
  });

  let server;
  try {
    console.log('→ Starting embedded PostgreSQL on port 5433...');
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('eduadmit');

    const databaseUrl = 'postgresql://eduadmit:eduadmit123@localhost:5433/eduadmit';
    const env = { DATABASE_URL: databaseUrl, PORT: String(PORT), JWT_SECRET: 'e2e-test-secret' };

    console.log('→ Initializing schema & seeding...');
    await run('node', ['src/seed.js'], env);

    console.log(`→ Starting API on port ${PORT}...`);
    server = spawn('node', ['src/server.js'], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', (d) => process.stdout.write(d));
    server.stderr.on('data', (d) => process.stderr.write(d));

    await waitForHealth();

    console.log('→ Running workflow tests...\n');
    await run('node', ['scripts/e2e-test.js', API], env);
  } finally {
    if (server) server.kill();
    try {
      await pg.stop();
    } catch {
      /* ignore cleanup errors */
    }
  }
}

main().catch((err) => {
  console.error('\nE2E runner failed:', err.message);
  process.exit(1);
});
