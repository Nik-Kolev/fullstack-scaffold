import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
	region: 'auto',
	endpoint: process.env.R2_ENDPOINT!,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID!,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
	},
});

// Returns a permanent public URL, deliberately — presigned/expiring URLs would need the
// @aws-sdk/s3-request-presigner package, worth adding only if a future project needs per-file privacy.
export async function uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
	await r2.send(
		new PutObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME!,
			Key: key,
			Body: buffer,
			ContentType: mimeType,
		}),
	);

	return `${process.env.R2_PUBLIC_URL}/${key}`;
}

// null when the URL isn't ours to delete (an externally-hosted imageUrl) — callers skip the delete.
export function keyFromPublicUrl(url: string): string | null {
	const prefix = `${process.env.R2_PUBLIC_URL}/`;

	return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

export async function deleteFile(key: string): Promise<void> {
	await r2.send(
		new DeleteObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME!,
			Key: key,
		}),
	);
}

export default r2;
