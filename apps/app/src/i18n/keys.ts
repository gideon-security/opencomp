import type { AppConfig } from 'next-intl';

export type NavMessageKey = keyof AppConfig['Messages']['nav'];
export type AuthMessageKey = keyof AppConfig['Messages']['auth'];
export type ErrorsMessageKey = keyof AppConfig['Messages']['errors'];
