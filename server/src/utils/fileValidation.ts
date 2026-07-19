import CustomError from './customError.js';

// Client-supplied mimetype is trivially spoofable — verify the actual bytes match before trusting it.
const MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
	'image/jpeg': (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
	'image/png': (buf) =>
		buf.length >= 8 &&
		buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
	'image/webp': (buf) =>
		buf.length >= 12 &&
		buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
		buf.subarray(8, 12).toString('ascii') === 'WEBP',
	'application/pdf': (buf) => buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === '%PDF',
};

const EXTENSION_BY_MIME: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'application/pdf': 'pdf',
};

export function assertMatchesDeclaredType(file: Express.Multer.File): void {
	const matchesType = MAGIC_BYTES[file.mimetype]?.(file.buffer) ?? false;
	if (!matchesType) {
		throw new CustomError(400, `File content does not match declared type ${file.mimetype}.`);
	}
}

// Non-null: only ever called after assertMatchesDeclaredType has confirmed the
// mimetype is one of MAGIC_BYTES' keys, which are exactly EXTENSION_BY_MIME's keys.
export function extensionForMimeType(mimeType: string): string {
	return EXTENSION_BY_MIME[mimeType]!;
}
