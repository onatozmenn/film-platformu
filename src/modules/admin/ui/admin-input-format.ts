export function dateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function dateTimeInputValue(value: Date | null): string {
  return value === null ? "" : value.toISOString().slice(0, 16);
}
