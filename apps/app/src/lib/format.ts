// Re-export canonical formatters from @gideon-defender/utils/format
// Keeps `@/lib/format` as the app's import path while single-sourcing logic.
export {
  formatDate,
  formatDateLocale,
  formatDateShort,
  formatDateTime,
  formatDateYmd,
  formatDateSlash,
  formatDateNumeric,
} from '@gideon-defender/utils/format';
