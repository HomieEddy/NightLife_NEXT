/* eslint-disable */
// Typed message keys — next-intl TS augmentation.
// A key present in en.json and missing in fr.json is a build error.
// Used by `useTranslations()` / `getTranslations()` for auto-completion.
type _IntlMessages = typeof import("../messages/en.json");

declare interface IntlMessages extends _IntlMessages {}
