export const SEASON_START_MONTH = 6; // Temmuz (0-indexed)
export const SEASON_START_DAY = 1;

export function getDateFromDay(day: number, season: number): Date {
  const date = new Date(2026 + season - 1, SEASON_START_MONTH, SEASON_START_DAY);
  date.setDate(date.getDate() + day);
  return date;
}

export function formatGameDate(day: number, season: number): string {
  const date = getDateFromDay(day, season);
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatShortDate(day: number, season: number): string {
  const date = getDateFromDay(day, season);
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
