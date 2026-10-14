import { format, parseISO } from 'date-fns';
import { getLocalISODate } from './date';

export type CompetitionWeekPhase = 'scheduled' | 'live' | 'completed';

export function getCompetitionWeekPhase(
  startDate?: string | null,
  endDate?: string | null,
  now: Date = new Date()
): CompetitionWeekPhase | null {
  if (!startDate || !endDate) return null;

  const today = getLocalISODate(now);
  if (today < startDate) return 'scheduled';
  if (today > endDate) return 'completed';
  return 'live';
}

export function formatWeekKickoff(startDate?: string | null): string {
  if (!startDate) return 'Sunday';
  return format(parseISO(startDate), 'EEE, MMM d');
}
