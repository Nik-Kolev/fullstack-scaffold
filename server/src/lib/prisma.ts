import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter }).$extends({
	result: {
		user: {
			hasPassword: {
				needs: { password: true },
				compute(user) {
					return user.password !== null;
				},
			},
		},
	},
});

export default prisma;
