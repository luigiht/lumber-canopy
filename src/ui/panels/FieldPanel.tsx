'use client';

import { useGame } from '@/game/store';
import { FIELD, fieldBeds } from '@/config/field';
import { formatCost, itemDef, parsePlantItem, type Cost, type ItemId } from '@/game/items';
import { SPECIES, STAGE_NAMES, potHoursLeft, potProgress, potStage } from '@/game/plants';
import { bedSeedHours, buildField, canAfford, harvestBed, missingFor, nextFieldBuild, plantBed } from '@/game/actions';
import { Dialog, Section } from '../Dialog';
import { ItemIcon } from '../ItemIcon';
import hud from '../hud.module.css';
import ui from '../ui.module.css';

const hours = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`);

/** Cost line with a Build button, for making the field or adding beds. */
function BuildRow({ label, cost }: { label: string; cost: Cost }) {
  const ok = canAfford(cost);
  return (
    <div className={ui.spread}>
      <span className={`${ui.small} ${ok ? ui.good : ui.warn}`}>
        {formatCost(cost)}
        {!ok && ` (need ${formatCost(missingFor(cost))} more)`}
      </span>
      <button className={`${ui.text} ${ok ? ui.primary : ''}`} onClick={buildField} disabled={!ok}>
        {label}
      </button>
    </div>
  );
}

/**
 * The garden field in front of the cabin: build it, sow seeds in its beds (one seed and one soil,
 * no pot), and harvest more seeds than you sowed.
 */
export function FieldPanel() {
  const field = useGame((s) => s.field);
  const elapsed = useGame((s) => s.elapsed);
  const inventory = useGame((s) => s.inventory);
  const open = fieldBeds(field.level);
  const next = nextFieldBuild();
  const seeds = Object.keys(inventory).filter((id) => parsePlantItem(id)?.kind === 'seed' && inventory[id] > 0) as ItemId[];
  const soil = inventory.soil ?? 0;

  return (
    <Dialog title="Garden field" onClose={() => useGame.setState({ panel: null })} wide>
      {open === 0 ? (
        <Section title="Build the field">
          <p className={ui.p}>
            Dig a few raised beds in front of the cabin. Sow seeds there to grow more seeds: no pots needed, just a little
            soil.
          </p>
          {next && <BuildRow label={`Build ${next.beds} beds`} cost={next.cost as Cost} />}
        </Section>
      ) : (
        <>
          <p className={ui.note}>
            Sowing uses 1 seed and 1 soil (you have {soil}). Each bed gives back more seeds of its kind when it’s ready.
          </p>
          <Section title={`Beds · ${field.beds.slice(0, open).filter(Boolean).length} of ${open} sown`}>
            <ul className={ui.list}>
              {field.beds.slice(0, open).map((bed, i) => {
                if (!bed)
                  return (
                    <li key={i} className={ui.card}>
                      <div className={ui.cardTitle}>
                        <span>Bed {i + 1}</span>
                        <span className={ui.muted}>Empty</span>
                      </div>
                      {seeds.length === 0 ? (
                        <p className={ui.note}>No seeds in your bag. Pick some from the broadleaf trees.</p>
                      ) : (
                        <div className={ui.row}>
                          {seeds.map((id) => {
                            const sp = SPECIES[parsePlantItem(id)!.species];
                            return (
                              <button
                                key={id}
                                className={ui.text}
                                onClick={() => plantBed(i, id)}
                                disabled={soil < 1}
                                title={`${sp.fieldSeeds} seeds back in ${Math.round(bedSeedHours(sp.id))} in-game hours`}
                              >
                                <ItemIcon icon="seed" /> {itemDef(id).name} ×{inventory[id]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                const sp = SPECIES[bed.species];
                const stage = potStage(bed, elapsed);
                const progress = potProgress(bed, elapsed);
                return (
                  <li key={i} className={ui.card}>
                    <div className={ui.cardTitle}>
                      <span>
                        <span className={ui.icon}>
                          <ItemIcon icon={stage === 3 ? 'seed' : 'sprout'} />
                        </span>{' '}
                        {sp.name}
                        <span className={ui.muted}> · bed {i + 1}</span>
                      </span>
                      <span className={stage === 3 ? ui.good : ui.muted}>
                        {stage === 3 ? 'Seeds ready' : STAGE_NAMES[stage]}
                      </span>
                    </div>
                    <div
                      className={hud.progress}
                      role="progressbar"
                      aria-label={`${sp.name} bed growth`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress * 100)}
                    >
                      <div className={hud.progressFill} style={{ width: `${progress * 100}%` }} />
                    </div>
                    {stage === 3 ? (
                      <div className={ui.row}>
                        <button className={`${ui.text} ${ui.primary}`} onClick={() => harvestBed(i)}>
                          Harvest {sp.fieldSeeds} seeds
                        </button>
                      </div>
                    ) : (
                      <p className={ui.note}>Seeds in about {hours(potHoursLeft(bed, elapsed))} of game time.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
          {next ? (
            <Section title="Expand">
              <p className={ui.note}>
                Add {next.beds - open} more beds ({next.beds} in all).
              </p>
              <BuildRow label="Add beds" cost={next.cost as Cost} />
            </Section>
          ) : (
            <p className={`${ui.note} ${ui.good}`}>The field is fully built: {FIELD.builds.at(-1)!.beds} beds.</p>
          )}
        </>
      )}
    </Dialog>
  );
}
