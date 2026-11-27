'use client';

import { useState } from 'react';
import { useGame } from '@/game/store';
import { MATERIAL_IDS, itemDef, parsePlantItem } from '@/game/items';
import { Dialog } from '../Dialog';
import { ItemIcon } from '../ItemIcon';
import hud from '../hud.module.css';
import ui from '../ui.module.css';

const order = (id: string) => {
  const m = MATERIAL_IDS.indexOf(id as (typeof MATERIAL_IDS)[number]);
  if (m >= 0) return m;
  const p = parsePlantItem(id);
  return 100 + (p ? ['plant', 'cutting', 'seed'].indexOf(p.kind) * 10 : 50);
};

/** Everything the player carries, with where each thing comes from. */
export function InventoryPanel() {
  const inventory = useGame((s) => s.inventory);
  const coins = useGame((s) => s.coins);
  const items = Object.entries(inventory)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => order(a) - order(b));
  const [selected, setSelected] = useState<string | null>(items[0]?.[0] ?? null);
  const def = selected && inventory[selected] ? itemDef(selected) : null;

  return (
    <Dialog title="Inventory" onClose={() => useGame.setState({ panel: null })} wide>
      <p className={ui.p}>
        <span className={ui.icon}>
          <ItemIcon icon="coin" />
        </span>{' '}
        {coins} coins
      </p>
      {items.length === 0 ? (
        <p className={ui.p}>Your bag is empty. Fish the river from the bridge to find materials.</p>
      ) : (
        <div className={ui.grid} role="listbox" aria-label="Items">
          {items.map(([id, n]) => {
            const d = itemDef(id);
            return (
              <button
                key={id}
                role="option"
                aria-selected={selected === id}
                className={`${ui.slot} ${selected === id ? hud.active : ''}`}
                onClick={() => setSelected(id)}
                title={`${d.name}: ${d.source}`}
              >
                <span className={ui.icon} aria-hidden="true">
                  <ItemIcon icon={d.icon} />
                </span>
                <span className={ui.slotName}>{d.name}</span>
                <span className={ui.count}>× {n}</span>
              </button>
            );
          })}
        </div>
      )}
      {def && (
        <div className={`${ui.card} ${ui.details}`} aria-live="polite">
          <div className={ui.cardTitle}>
            <span>
              <span className={ui.icon}>
                <ItemIcon icon={def.icon} />
              </span> {def.name}
            </span>
            <span className={ui.count}>× {inventory[selected!]}</span>
          </div>
          <p className={ui.note}>From: {def.source}</p>
          <p className={ui.note}>Used for: {def.use}</p>
        </div>
      )}
    </Dialog>
  );
}
