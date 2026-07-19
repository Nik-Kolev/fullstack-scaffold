import { rmSync, readdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

if (process.env.NODE_ENV === 'production') {
	console.error('db:fresh cannot be run in production.');
	process.exit(1);
}

const migrationsDir = 'prisma/migrations';

if (existsSync(migrationsDir)) {
	for (const entry of readdirSync(migrationsDir)) {
		if (entry !== 'migration_lock.toml') {
			rmSync(`${migrationsDir}/${entry}`, { recursive: true, force: true });
		}
	}
	console.log('Cleared migration history.');
}

execSync('prisma migrate reset --force', { stdio: 'inherit' });

// --create-only, then hand-inject extensions that aren't expressible in schema.prisma
// (postgresqlExtensions is deprecated) — schema-diffing alone would drop them on a fresh init.
execSync('prisma migrate dev --name init --create-only', { stdio: 'inherit' });

const initFolder = readdirSync(migrationsDir).find((entry) => entry !== 'migration_lock.toml');
const migrationPath = `${migrationsDir}/${initFolder}/migration.sql`;
const sql = readFileSync(migrationPath, 'utf-8');
const PG_TRGM_HEADER =
	'-- pg_trgm enabled inline here (not its own migration) because this schema is\n' +
	'-- currently squashed to one init migration via db-fresh; split into an earlier,\n' +
	'-- separate migration once real migration history starts (see prisma.md).\n' +
	'CREATE EXTENSION IF NOT EXISTS pg_trgm;\n\n';
writeFileSync(migrationPath, `${PG_TRGM_HEADER}${sql}`);

execSync('prisma migrate dev', { stdio: 'inherit' });
