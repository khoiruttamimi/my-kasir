import assert from 'node:assert/strict';
import { expect, test } from '@jest/globals';
import { loadSource } from '../../../tests/helpers/load-source';

test('internal checksum helper pads range boundaries, handles a zero check digit, and rejects out-of-range values', () => {
  const { formatInternalProductCode } = loadSource<typeof import('@/server/utils/product-code')>(
    'src/server/utils/product-code.ts',
  );
  expect(formatInternalProductCode('0')).toBe('2000000000008');
  expect(formatInternalProductCode('6')).toBe('2000000000060');
  for (const value of ['0', '6', '9999999999']) {
    const code = formatInternalProductCode(value);
    expect(code).toMatch(/^20\d{11}$/);
    expect([...code].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10).toBe(0);
  }
  for (const value of ['-1', '10000000000', '1.5', 'NaN', '', ' 1 ']) {
    assert.throws(() => formatInternalProductCode(value));
  }
});
