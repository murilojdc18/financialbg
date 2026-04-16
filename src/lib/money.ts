export function round2(value: number): number {
  const numericValue = Number.isFinite(value) ? value : 0;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
}

export function isZeroMoney(value: number): boolean {
  return Math.abs(round2(value)) < 0.01;
}