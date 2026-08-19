import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  // Locale is resolved from the user preference cookie / Accept-Language, not
  // from the URL. The authenticated product has no public pages to crawl, so we
  // keep the existing [orgId] route tree untouched.
  localePrefix: 'never',
});
