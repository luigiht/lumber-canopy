'use client';

import { useGame } from '@/game/store';
import { formatCost, parsePlantItem, type Cost } from '@/game/items';
import { SPECIES } from '@/game/plants';
import { sellPlant } from '@/game/actions';
import { ItemIcon } from '../ItemIcon';
import { Dialog } from '../Dialog';
import ui from '../ui.module.css';

/** Sell grown plants for coins, or trade them for reclaimed materials. */
export function DeliveryPanel() {
  const inventory = useGame((s) => s.inventory);
  const coins = useGame((s) => s.coins);
  const plants = Object.keys(inventory).filter((id) => parsePlantItem(id)?.kind === 'plant' && inventory[id] > 0);

  return (
    <Dialog title="Delivery box" onClose={() => useGame.setState({ panel: null })} wide>
      <p className={ui.p}>
        Leave plants here and a buyer collects them from the road. <ItemIcon icon="coin" /> {coins} coins
      </p>
      {plants.length === 0 ? (
        <p className={ui.p}>
          You have no grown plants in your bag. At the potting table, choose “Put in bag” on a mature plant.
        </p>
      ) : (
        <ul className={ui.list}>
          {plants.map((id) => {
            const species = parsePlantItem(id)!.species;
            const sp = SPECIES[species];
            return (
              <li key={id} className={ui.card}>
                <div className={ui.cardTitle}>
                  <span>
                    <ItemIcon icon="potted" /> {sp.name}
                  </span>
                  <span>× {inventory[id]}</span>
                </div>
                <div className={ui.row}>
                  <button className={`${ui.text} ${ui.primary}`} onClick={() => sellPlant(species, 'coins')}>
                    Sell for {sp.price} coins
                  </button>
                  <button className={ui.text} onClick={() => sellPlant(species, 'trade')}>
                    Trade for {formatCost(sp.trade as Cost)}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
