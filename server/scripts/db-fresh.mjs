import { rmSync, readdirSync, existsSync } from 'fs';
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
execSync('prisma migrate dev --name init', { stdio: 'inherit' });
