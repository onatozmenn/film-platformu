const locale = "tr-TR";

const dateFormatter = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

const numberFormatter = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 1,
});

const yearFormatter = new Intl.DateTimeFormat(locale, {
  timeZone: "UTC",
  year: "numeric",
});

export function formatDate(value: Date | number | string): string {
  return dateFormatter.format(new Date(value));
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatYear(value: Date | number | string): string {
  return yearFormatter.format(new Date(value));
}
