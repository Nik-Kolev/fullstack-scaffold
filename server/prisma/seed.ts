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

	const electronics = await prisma.productCategory.upsert({
		where: { name: 'Electronics' },
		update: {},
		create: { name: 'Electronics' },
	});
	const books = await prisma.productCategory.upsert({
		where: { name: 'Books' },
		update: {},
		create: { name: 'Books' },
	});

	const productCount = await prisma.product.count();
	if (productCount === 0) {
		await prisma.product.createMany({
			data: [
				{
					name: 'Wireless Bluetooth Headphones',
					price: 7999,
					description: 'Over-ear headphones with active noise cancellation',
					categoryId: electronics.id,
					quantity: 50,
					color: 'black',
					shape: 'oval',
				},
				{
					name: 'The Pragmatic Programmer',
					price: 3499,
					description: 'Classic guide to software craftsmanship',
					categoryId: books.id,
					quantity: 20,
					color: 'orange',
					shape: 'rectangle',
				},
			],
		});
	}

	console.log(user, admin);
}

seedData()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
