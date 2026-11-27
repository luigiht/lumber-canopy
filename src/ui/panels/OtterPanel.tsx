'use client';

import { useGame } from '@/game/store';
import { itemDef, parsePlantItem, type ItemId } from '@/game/items';
import { FRIEND_FEEDS, OTTER_LEVELS, isFriend, nextLevelAt, otterLevel } from '@/game/otter';
import { feedOtter } from '@/game/actions';
import { Dialog } from '../Dialog';
import { ItemIcon } from '../ItemIcon';
import ui from '../ui.module.css';

/** Friendship hearts, the seeds you can feed, and what the otter is up to. */
export function OtterPanel() {
  const feeds = useGame((s) => s.otter.feeds);
  const busy = useGame((s) => s.otterBusy);
  const inventory = useGame((s) => s.inventory);
  const friend = isFriend(feeds);
  const level = otterLevel(feeds);
  const next = nextLevelAt(feeds);
  const seeds = Object.keys(inventory).filter((id) => parsePlantItem(id)?.kind === 'seed' && inventory[id] > 0) as ItemId[];
  const hearts = friend ? OTTER_LEVELS.length : FRIEND_FEEDS;
  const filled = friend ? level : feeds;

  return (
    <Dialog title={friend ? 'Your otter friend' : 'River otter'} onClose={() => useGame.setState({ panel: null })}>
      <div className={ui.spread}>
        <span className={ui.row} aria-label={`${filled} of ${hearts} hearts`}>
          {Array.from({ length: hearts }, (_, i) => (
            <span key={i} className={ui.icon} style={{ opacity: i < filled ? 1 : 0.28 }}>
              <ItemIcon icon="heart" />
            </span>
          ))}
        </span>
        <span className={ui.heading}>{friend ? OTTER_LEVELS[level - 1].name : 'Shy'}</span>
      </div>
      <p className={ui.p}>
        {friend
          ? 'Feed it a seed and it dives into the river to bring you something back. The closer you are, the rarer its finds.'
          : `This otter watches you from the riverbank. Feed it seeds to win its trust: ${FRIEND_FEEDS - feeds} more to go.`}
      </p>
      <p className={ui.note}>
        Seeds fed: {feeds}
        {next !== null && ` · next heart at ${next}`}
      </p>
      {busy ? (
        <p className={`${ui.p} ${ui.good}`} role="status">
          Diving for treasure…
        </p>
      ) : seeds.length === 0 ? (
        <p className={ui.p}>You have no seeds. Seeds turn up in bottles while fishing, and your otter friend finds them too.</p>
      ) : (
        <ul className={ui.list}>
          {seeds.map((id) => (
            <li key={id} className={ui.spread}>
              <span>
                <ItemIcon icon={itemDef(id).icon} /> {itemDef(id).name} × {inventory[id]}
              </span>
              <button className={`${ui.text} ${ui.primary}`} onClick={() => feedOtter(id)}>
                Feed
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
