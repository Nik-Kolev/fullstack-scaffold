export type SafeUser = {
	id: number;
	name: string;
	email: string;
	role: string;
	hasPassword: boolean;
	createdAt: Date;
};

export const toSafeUser = (user: {
	id: number;
	name: string;
	email: string;
	role: string;
	hasPassword: boolean;
	createdAt: Date;
}): SafeUser => ({
	id: user.id,
	name: user.name,
	email: user.email,
	role: user.role,
	hasPassword: user.hasPassword,
	createdAt: user.createdAt,
});
