const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

export function formatDateTime(value: string): string {
  return `${dateTimeFormatter.format(new Date(value))} WIB`;
}
