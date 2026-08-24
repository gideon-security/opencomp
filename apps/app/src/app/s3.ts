import { S3Client } from '@aws-sdk/client-s3';

const APP_AWS_REGION = process.env.APP_AWS_REGION;
const APP_AWS_ACCESS_KEY_ID = process.env.APP_AWS_ACCESS_KEY_ID;
const APP_AWS_SECRET_ACCESS_KEY = process.env.APP_AWS_SECRET_ACCESS_KEY;
const APP_AWS_ENDPOINT = process.env.APP_AWS_ENDPOINT;

export const BUCKET_NAME = process.env.APP_AWS_BUCKET_NAME;
export const APP_AWS_ORG_ASSETS_BUCKET = process.env.APP_AWS_ORG_ASSETS_BUCKET;

let s3ClientInstance: S3Client;

try {
  if (!APP_AWS_ACCESS_KEY_ID || !APP_AWS_SECRET_ACCESS_KEY || !BUCKET_NAME || !APP_AWS_REGION) {
    console.error('[S3] AWS S3 credentials or configuration missing. Check environment variables.');
    throw new Error('AWS S3 credentials or configuration missing. Check environment variables.');
  }

  s3ClientInstance = new S3Client({
    endpoint: APP_AWS_ENDPOINT || undefined,
    region: APP_AWS_REGION,
    credentials: {
      accessKeyId: APP_AWS_ACCESS_KEY_ID,
      secretAccessKey: APP_AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: !!APP_AWS_ENDPOINT,
  });
} catch (error) {
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('!!! FAILED TO INITIALIZE S3 CLIENT !!!');
  console.error('!!! This is likely due to missing or invalid environment variables. !!!');
  console.error('Error:', error);
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');

  // Create a dummy client that will fail gracefully at runtime instead of crashing during initialization
  s3ClientInstance = null as any;
  console.error(
    '[S3] Creating dummy S3 client - file uploads will fail until credentials are fixed',
  );
}

export const s3Client = s3ClientInstance;

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
