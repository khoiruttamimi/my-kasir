/** @jest-environment jsdom */
import '@testing-library/jest-dom/jest-globals';
import { beforeAll, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import PaginationTable from './index';

beforeAll(() => {
  // Ant Design observes viewport breakpoints through matchMedia.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

test('shows the total and reports the selected page with the current page size', () => {
  const onChange = jest.fn();
  render(<PaginationTable page={1} limit={10} total={25} onChange={onChange} />);
  expect(screen.getByText('Total 25 items')).toBeInTheDocument();
  fireEvent.click(screen.getByTitle('2'));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(2, 10);
});
