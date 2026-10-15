// Decimal text keeps identifiers distinct from money/quantities and preserves padding.
export function formatInternalProductCode(value: string): string {
  if (!/^\d{1,10}$/.test(value)) throw new Error('Internal product code position is out of range');
  const payload = `20${value.padStart(10, '0')}`;
  const total = [...payload].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0);
  return `${payload}${(10 - (total % 10)) % 10}`;
}
