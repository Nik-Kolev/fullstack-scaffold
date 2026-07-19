import bcrypt from 'bcrypt';
import prisma from '../src/lib/prisma.js';

if (process.env.NODE_ENV === 'production') {
	console.error('seed-bulk cannot be run in production.');
	process.exit(1);
}

const PRODUCT_COUNT = 400_000;
const USER_COUNT = 300;

async function seedBulk() {
	const categories = await prisma.productCategory.findMany({ select: { id: true } });
	if (categories.length === 0) {
		console.error('No categories found — run npm run db:fresh first.');
		process.exit(1);
	}
	const categoryIds = categories.map((c) => c.id).join(',');

	console.log(`Inserting ${PRODUCT_COUNT} products...`);
	// categoryIds/PRODUCT_COUNT are our own trusted integers (from the DB or a
	// constant above), never user input — $executeRawUnsafe here carries no
	// injection risk. random() is volatile, so each array index below is
	// re-evaluated per generated row, not folded into one value for all rows.
	await prisma.$executeRawUnsafe(`
		INSERT INTO products (name, price, quantity, discount_percent, color, shape, category_id, created_at)
		SELECT
			'Bulk Product ' || gs,
			(floor(random() * 20000) + 100)::int,
			(floor(random() * 200))::int,
			CASE WHEN random() < 0.2 THEN (floor(random() * 50))::int ELSE NULL END,
			(ARRAY['Black','White','Red','Blue','Green'])[floor(random() * 5 + 1)],
			(ARRAY['Round','Square','Oval','Rectangle'])[floor(random() * 4 + 1)],
			(ARRAY[${categoryIds}])[floor(random() * ${categories.length} + 1)],
			now() - (random() * interval '365 days')
		FROM generate_series(1, ${PRODUCT_COUNT}) AS gs
	`);

	console.log(`Seeding ${USER_COUNT} load-test users...`);
	const hashedPassword = await bcrypt.hash('loadtest1', 10);
	await prisma.user.createMany({
		data: Array.from({ length: USER_COUNT }, (_, i) => ({
			email: `loadtest+${i + 1}@test.local`,
			password: hashedPassword,
			name: `Load Test User ${i + 1}`,
			role: 'user',
		})),
		skipDuplicates: true,
	});

	const productCount = await prisma.product.count();
	const userCount = await prisma.user.count();
	console.log(`Done. products=${productCount} users=${userCount}`);
}

seedBulk()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
