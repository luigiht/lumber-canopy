/** In-game calendar. Seasons cycle in this order, each lasting `daysPerSeason` in-game days. */
export const CALENDAR = {
  daysPerSeason: 7,
  seasons: ['Spring', 'Summer', 'Autumn', 'Winter'] as const,
};

export type Season = (typeof CALENDAR.seasons)[number];

/** Season for a 1-based day count. */
export function seasonOf(day: number): Season {
  const { seasons, daysPerSeason } = CALENDAR;
  return seasons[Math.floor((day - 1) / daysPerSeason) % seasons.length];
}
