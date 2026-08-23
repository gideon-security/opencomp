import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl as _getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Re-export getSignedUrl with a type workaround for bun's duplicate @smithy/types.
 * Bun on Vercel installs separate @smithy/types copies for @aws-sdk/client-s3
 * and @aws-sdk/s3-request-presigner even when pinned to the same version.
 * The runtime types are fully compatible — only the TypeScript class identity differs.
 */
export const getSignedUrl = _getSignedUrl as unknown as (
  client: S3Client,
  command: GetObjectCommand | PutObjectCommand,
  options?: { expiresIn?: number },
) => Promise<string>;

const APP_AWS_REGION = process.env.APP_AWS_REGION;
const APP_AWS_ACCESS_KEY_ID = process.env.APP_AWS_ACCESS_KEY_ID;
const APP_AWS_SECRET_ACCESS_KEY = process.env.APP_AWS_SECRET_ACCESS_KEY;
const APP_AWS_ENDPOINT = process.env.APP_AWS_ENDPOINT;

export const BUCKET_NAME = process.env.APP_AWS_BUCKET_NAME;
export const APP_AWS_ORG_ASSETS_BUCKET = process.env.APP_AWS_ORG_ASSETS_BUCKET;

if (!APP_AWS_ACCESS_KEY_ID || !APP_AWS_SECRET_ACCESS_KEY || !BUCKET_NAME || !APP_AWS_REGION) {
  console.warn(
    'AWS S3 credentials or configuration missing in environment variables. File upload features will be unavailable.',
  );
}

// Create a single S3 client instance
// Add null checks or assertions if the checks above don't guarantee non-null values
export const s3Client = new S3Client({
  endpoint: APP_AWS_ENDPOINT || undefined,
  region: APP_AWS_REGION!,
  credentials: {
    accessKeyId: APP_AWS_ACCESS_KEY_ID!,
    secretAccessKey: APP_AWS_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: !!APP_AWS_ENDPOINT,
});

// Ensure BUCKET_NAME is exported and non-null checked if needed elsewhere explicitly
if (!BUCKET_NAME && process.env.NODE_ENV === 'production') {
  console.error('AWS_BUCKET_NAME is not defined.');
}

/**
 * Validates if a hostname is a valid AWS S3 endpoint
 */
function isValidS3Host(host: string): boolean {
  const normalizedHost = host.toLowerCase();

  // Must end with amazonaws.com
  if (!normalizedHost.endsWith('.amazonaws.com')) {
    return false;
  }

  // Check against known S3 patterns
  return /^([\w.-]+\.)?(s3|s3-[\w-]+|s3-website[\w.-]+|s3-accesspoint|s3-control)(\.[\w-]+)?\.amazonaws\.com$/.test(
    normalizedHost,
  );
}
