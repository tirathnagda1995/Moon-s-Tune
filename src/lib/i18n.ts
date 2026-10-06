import en from "../locales/en";
import hi from "../locales/hi";
import ar from "../locales/ar";
export const supportedLocales = ["en", "hi", "ar"] as const;
export const futureLocales = [
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "nl",
  "pl",
  "tr",
  "gu",
  "mr",
  "bn",
  "ta",
  "te",
  "kn",
  "ml",
  "pa",
  "ur",
  "id",
  "vi",
  "th",
  "ja",
  "ko",
  "zh-Hans",
  "zh-Hant",
];
export type Messages = typeof en;
export function messages(locale: string): Messages {
  const base = locale.split("-")[0];
  return {
    ...en,
    ...(base === "hi" ? hi : base === "ar" ? ar : {}),
  } as Messages;
}
export const direction = (locale: string) =>
  ["ar", "ur", "he", "fa"].includes(locale.split("-")[0]) ? "rtl" : "ltr";
export function format(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

export function formatPlural(
  locale: string,
  forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
  count: number,
) {
  const category = new Intl.PluralRules(locale).select(count);
  return format(forms[category] ?? forms.other, {
    count: new Intl.NumberFormat(locale).format(count),
  });
}
