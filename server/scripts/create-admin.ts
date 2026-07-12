import prisma from '../src/lib/prisma.js';
import bcrypt from 'bcrypt';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME;

if (!email || !password || !name) {
	console.error('Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run create-admin');
	console.error('Values must be env vars, not CLI args — CLI args land in shell history.');
	process.exit(1);
}

async function createAdmin() {
	const hashedPassword = await bcrypt.hash(password, 10);

	const admin = await prisma.user.upsert({
		where: { email },
		update: { role: 'admin', password: hashedPassword, name },
		create: { email, password: hashedPassword, name, role: 'admin' },
	});

	console.log(`${admin.email} is now an admin.`);
}

createAdmin()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
