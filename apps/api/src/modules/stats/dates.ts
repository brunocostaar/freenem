const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data (YYYY-MM-DD) em America/Sao_Paulo. */
export function saoPauloDate(at: Date = new Date()): string {
  return fmt.format(at);
}
