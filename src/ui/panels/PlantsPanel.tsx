'use client';

import { useGame } from '@/game/store';
import { DECOR_SLOTS, slotPlace } from '@/config/stations';
import { itemDef, parsePlantItem, type ItemId } from '@/game/items';
import { SPECIES, STAGE_NAMES, potHoursLeft, potProgress, potStage, type SpeciesId } from '@/game/plants';
import { count, pickUpPlant, placePlant, plant, potUp, tableCapacity, takeCuttings } from '@/game/actions';
import { Dialog, Section } from '../Dialog';
import { ItemIcon } from '../ItemIcon';
import hud from '../hud.module.css';
import ui from '../ui.module.css';

const hours = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`);

/**
 * Plant management: pots growing on the potting table (with growth stage and time left), mature
 * plants to place, propagate or pot up, and planting new ones when standing at the table.
 */
export function PlantsPanel({ atTable }: { atTable: boolean }) {
  const { pots, elapsed, inventory, decor } = useGame();
  const capacity = tableCapacity();
  const startable = Object.keys(inventory).filter((id) => {
    const p = parsePlantItem(id);
    return p && p.kind !== 'plant' && inventory[id] > 0;
  }) as ItemId[];
  const bagPlants = Object.keys(inventory).filter((id) => parsePlantItem(id)?.kind === 'plant' && inventory[id] > 0);
  const placed = decor.filter(Boolean).length;

  return (
    <Dialog title={atTable ? 'Potting table' : 'Plants'} onClose={() => useGame.setState({ panel: null })} wide>
      <Section title={`On the potting table · ${pots.length} of ${capacity}`}>
        {pots.length === 0 ? (
          <p className={ui.p}>Nothing growing yet.</p>
        ) : (
          <ul className={ui.list}>
            {pots.map((pot) => {
              const sp = SPECIES[pot.species];
              const stage = potStage(pot, elapsed);
              const progress = potProgress(pot, elapsed);
              return (
                <li key={pot.id} className={ui.card}>
                  <div className={ui.cardTitle}>
                    <span>
                      <span className={ui.icon}>
                        <ItemIcon icon={stage === 3 ? 'potted' : 'sprout'} />
                      </span>{' '}
                      {sp.name}
                      <span className={ui.muted}> · from {pot.from}</span>
                    </span>
                    <span className={stage === 3 ? ui.good : ui.muted}>
                      Stage {stage}: {STAGE_NAMES[stage]}
                    </span>
                  </div>
                  <div
                    className={hud.progress}
                    role="progressbar"
                    aria-label={`${sp.name} growth`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                  >
                    <div className={hud.progressFill} style={{ width: `${progress * 100}%` }} />
                  </div>
                  {stage === 3 ? (
                    <div className={ui.row}>
                      <button className={`${ui.text} ${ui.primary}`} onClick={() => placePlant(pot.species, pot.id)}>
                        Place
                      </button>
                      <button className={ui.text} onClick={() => takeCuttings(pot.id)}>
                        Take {sp.cuttings} cuttings
                      </button>
                      <button className={ui.text} onClick={() => potUp(pot.id)}>
                        Put in bag
                      </button>
                    </div>
                  ) : (
                    <p className={ui.note}>Mature in about {hours(potHoursLeft(pot, elapsed))} of game time.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Plant something">
        {atTable ? (
          <>
            <p className={ui.note}>
              Each plant needs a pot ({count('pot')}) and soil ({count('soil')}) plus a seed or cutting.
            </p>
            {startable.length === 0 ? (
              <p className={ui.p}>No seeds or cuttings. Take cuttings from a mature plant, or fish for bottles.</p>
            ) : (
              <ul className={ui.list}>
                {startable.map((id) => (
                  <li key={id} className={ui.spread}>
                    <span>
                      <span className={ui.icon}>
                        <ItemIcon icon={itemDef(id).icon} />
                      </span> {itemDef(id).name} × {inventory[id]}
                    </span>
                    <button className={ui.text} onClick={() => plant(id)} disabled={pots.length >= capacity}>
                      Plant
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className={ui.p}>Visit the potting table to plant seeds and cuttings.</p>
        )}
      </Section>

      <Section title="In your bag">
        {bagPlants.length === 0 ? (
          <p className={ui.p}>No grown plants in your bag.</p>
        ) : (
          <ul className={ui.list}>
            {bagPlants.map((id) => {
              const species = parsePlantItem(id)!.species;
              return (
                <li key={id} className={ui.spread}>
                  <span>
                    <ItemIcon icon="potted" /> {SPECIES[species].name} × {inventory[id]}
                  </span>
                  <button className={ui.text} onClick={() => placePlant(species)}>
                    Place
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Plants on display are managed from the Plants panel (P), not at the potting table. */}
      {!atTable && (
        <Section title={`In and around your cabin · ${placed} of ${DECOR_SLOTS.length}`}>
          <p className={ui.note}>Every 4 plants on display makes room for one more pot on the table.</p>
          {placed > 0 && (
            <ul className={ui.list}>
              {decor.map((sp, i) =>
                sp ? (
                  <li key={i} className={ui.spread}>
                    <span>
                      <ItemIcon icon="potted" /> {SPECIES[sp as SpeciesId].name}
                      <span className={ui.muted}> · {slotPlace(i)}</span>
                    </span>
                    <button className={ui.text} onClick={() => pickUpPlant(i)}>
                      Pick up
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </Section>
      )}
    </Dialog>
  );
}
