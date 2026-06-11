import prisma from '../src/lib/prisma.js';
import bcrypt from 'bcrypt';

async function seedData() {
	const hashedPassword = await bcrypt.hash('1234', 10);

	const user = await prisma.user.upsert({
		where: { email: 'test@abv.bg' },
		update: {},
		create: {
			email: 'test@abv.bg',
			role: 'user',
			password: hashedPassword,
			name: 'user',
		},
	});

	const admin = await prisma.user.upsert({
		where: { email: 'admin@abv.bg' },
		update: {},
		create: {
			email: 'admin@abv.bg',
			role: 'admin',
			password: hashedPassword,
			name: 'admin',
		},
	});

	const nik = await prisma.user.upsert({
		where: { email: 'ngkolev93@gmail.com' },
		update: {},
		create: {
			email: 'ngkolev93@gmail.com',
			role: 'admin',
			password: hashedPassword,
			name: 'Nik',
		},
	});
	console.log(user, admin, nik);
}

seedData()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
