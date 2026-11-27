/** Friendship with the river otter: it grows with every seed you feed it. */

export interface OtterLevel {
  /** Total feeds needed to reach this level. */
  feeds: number;
  name: string;
  /** Chance a find is rare (fishing is 8–18%). */
  rare: number;
  /** Extra items on common and uncommon finds. */
  extra: number;
}

export const OTTER_LEVELS: OtterLevel[] = [
  { feeds: 3, name: 'Friend', rare: 0.15, extra: 0 },
  { feeds: 10, name: 'Good friend', rare: 0.22, extra: 0 },
  { feeds: 25, name: 'Best friend', rare: 0.3, extra: 1 },
];

/** Feeds before the otter trusts you enough to follow you. */
export const FRIEND_FEEDS = OTTER_LEVELS[0].feeds;

export const isFriend = (feeds: number) => feeds >= FRIEND_FEEDS;

/** Current level (1-based), or 0 before friendship. */
export function otterLevel(feeds: number) {
  let level = 0;
  OTTER_LEVELS.forEach((l, i) => {
    if (feeds >= l.feeds) level = i + 1;
  });
  return level;
}

/** Feeds needed for the next level, or null at the top. */
export function nextLevelAt(feeds: number) {
  return OTTER_LEVELS.find((l) => feeds < l.feeds)?.feeds ?? null;
}
