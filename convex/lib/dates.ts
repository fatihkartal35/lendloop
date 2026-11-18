const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isDay(s: string): boolean {
  return DAY.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}
