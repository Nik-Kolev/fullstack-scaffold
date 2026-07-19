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

export async function deleteFile(key: string): Promise<void> {
	await r2.send(
		new DeleteObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME!,
			Key: key,
		}),
	);
}

export default r2;
