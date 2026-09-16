// Re-export canonical formatters from @gideon-defender/utils/format
// Keeps `@/lib/format` as the app's import path while single-sourcing logic.
export {
  formatDate,
  formatDateLocale,
  formatDateNumeric,
  formatDateShort,
  formatDateSlash,
  formatDateTime,
  formatDateYmd,
} from '@gideon-defender/utils/format';
