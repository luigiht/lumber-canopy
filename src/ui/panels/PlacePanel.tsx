'use client';

import { useGame } from '@/game/store';
import { slotPlace } from '@/config/stations';
import { parsePlantItem } from '@/game/items';
import { SPECIES } from '@/game/plants';
import { pickUpPlant, placePlant } from '@/game/actions';
import { Dialog } from '../Dialog';
import { ItemIcon } from '../ItemIcon';
import ui from '../ui.module.css';

/** A plant spot inside the cabin: choose a grown plant for it, or pick up the one that's there. */
export function PlacePanel() {
  const slot = useGame((s) => s.placeSlot);
  const decor = useGame((s) => s.decor);
  const inventory = useGame((s) => s.inventory);
  if (slot === null) return null;
  const current = decor[slot];
  const close = () => useGame.setState({ panel: null, placeSlot: null });
  const plants = Object.keys(inventory).filter((id) => parsePlantItem(id)?.kind === 'plant' && inventory[id] > 0);

  return (
    <Dialog title={`${slotPlace(slot)} plant spot`} onClose={close}>
      {current ? (
        <div className={ui.spread}>
          <span className={ui.p}>
            <ItemIcon icon="potted" /> {SPECIES[current].name} lives here.
          </span>
          <button className={ui.text} onClick={() => pickUpPlant(slot)}>
            Pick up
          </button>
        </div>
      ) : plants.length === 0 ? (
        <p className={ui.p}>
          You have no grown plants in your bag. Grow one at the potting table, then choose “Put in bag” when it’s mature.
        </p>
      ) : (
        <>
          <p className={ui.p}>Which plant should go here?</p>
          <ul className={ui.list}>
            {plants.map((id) => {
              const species = parsePlantItem(id)!.species;
              return (
                <li key={id} className={ui.spread}>
                  <span>
                    <ItemIcon icon="potted" /> {SPECIES[species].name} × {inventory[id]}
                  </span>
                  <button
                    className={`${ui.text} ${ui.primary}`}
                    onClick={() => {
                      placePlant(species, undefined, slot);
                      close();
                    }}
                  >
                    Place here
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Dialog>
  );
}
