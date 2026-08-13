import { headers, cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

type Locale = (typeof routing)['locales'][number];

const locales: readonly string[] = routing.locales;

function resolveLocale(cookieLocale: string | undefined, acceptLanguage: string | null): Locale {
  if (cookieLocale && locales.includes(cookieLocale)) {
    return cookieLocale as Locale;
  }

  // Basic Accept-Language negotiation: walk the header (in q-value order) and
  // pick the first locale we support, matching on either the full tag or its
  // language base (e.g. "es-MX" -> "es").
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(',')) {
      const tag = part.split(';')[0]?.trim().toLowerCase();
      if (!tag) continue;
      const base = tag.split('-')[0] ?? tag;
      const match = locales.find((locale) => locale === tag || locale === base);
      if (match) return match as Locale;
    }
  }

  return routing.defaultLocale;
}

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value;
  const acceptLanguage = (await headers()).get('accept-language');
  const locale = resolveLocale(cookieLocale, acceptLanguage);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
