/**
 * Supported cloud provider slugs
 */
const CLOUD_PROVIDER_SLUGS = ['aws', 'gcp', 'azure'] as const;

/**
 * Type for supported cloud provider slugs
 */
type CloudProviderSlug = (typeof CLOUD_PROVIDER_SLUGS)[number];

/**
 * Type guard to check if a string is a supported cloud provider slug
 */
export const isCloudProviderSlug = (value: string): value is CloudProviderSlug =>
  CLOUD_PROVIDER_SLUGS.includes(value as CloudProviderSlug);
