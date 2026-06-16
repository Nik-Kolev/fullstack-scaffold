import z from 'zod';

export const folderNameSchema = z.object({
	folderName: z.string().min(1),
});
