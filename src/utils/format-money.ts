const numberOptions: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  ...numberOptions,
  style: 'currency',
  currency: 'IDR',
});

const numberFormatter = new Intl.NumberFormat('id-ID', numberOptions);

type FormatRupiahOptions = {
  currency?: boolean;
};

export function formatRupiah(value: number, { currency = true }: FormatRupiahOptions = {}): string {
  return (currency ? rupiahFormatter : numberFormatter).format(value);
}
