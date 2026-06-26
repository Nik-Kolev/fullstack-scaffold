import z from 'zod';

export const folderNameSchema = z.object({
	folderName: z
		.string()
		.regex(
			/^[\w-]+$/,
			'Folder name may only contain letters, numbers, underscores, and hyphens',
		),
});
