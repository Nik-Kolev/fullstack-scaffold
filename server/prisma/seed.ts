import prisma from '../src/lib/prisma.js';
import bcrypt from 'bcrypt';

async function seedData() {
	const hashedPassword = await bcrypt.hash('password1', 10);

	const user = await prisma.user.upsert({
		where: { email: 'test@abv.bg' },
		update: { password: hashedPassword },
		create: {
			email: 'test@abv.bg',
			role: 'user',
			password: hashedPassword,
			name: 'user',
		},
	});

	const admin = await prisma.user.upsert({
		where: { email: 'admin@abv.bg' },
		update: { password: hashedPassword },
		create: {
			email: 'admin@abv.bg',
			role: 'admin',
			password: hashedPassword,
			name: 'admin',
		},
	});

	const productCount = await prisma.product.count();
	if (productCount === 0) {
		await prisma.product.createMany({
			data: [
				{ name: 'Basic Plan', price: 999, description: 'Great for getting started' },
				{ name: 'Pro Plan', price: 2999, description: 'Perfect for growing teams' },
			],
		});
	}

	console.log(user, admin);
}

seedData()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
