import z from 'zod';

export const folderNameSchema = z.object({
	folderName: z
		.string()
		.min(1, 'Folder name is required.')
		.max(64, 'Folder name must be 64 characters or fewer.')
		.regex(
			/^[\w-]+$/,
			'Folder name may only contain letters, numbers, underscores, and hyphens',
		),
});
