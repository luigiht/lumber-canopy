'use client';

import { useGame } from '@/game/store';
import { formatCost } from '@/game/items';
import { MAX_TOOL_LEVEL, TOOLS, TOOL_IDS } from '@/game/tools';
import { POT_COST, canAfford, craftPot, missingFor, upgradeTool } from '@/game/actions';
import { ItemIcon } from '../ItemIcon';
import { Dialog, Section } from '../Dialog';
import ui from '../ui.module.css';

/** Upgrade tools with materials and coins from plant sales; make planter pots from scrap wood. */
export function WorkbenchPanel() {
  const tools = useGame((s) => s.tools);
  useGame((s) => s.inventory); // re-render when materials change
  const coins = useGame((s) => s.coins);

  return (
    <Dialog title="Workbench" onClose={() => useGame.setState({ panel: null })} wide>
      <p className={ui.p}><ItemIcon icon="coin" /> {coins} coins</p>
      <Section title="Upgrade tools">
        <ul className={ui.list}>
          {TOOL_IDS.map((id) => {
            const tool = TOOLS[id];
            const level = tools[id];
            const maxed = level >= MAX_TOOL_LEVEL;
            const cost = maxed ? null : tool.upgrades[level - 1];
            const missing = cost ? missingFor(cost) : {};
            return (
              <li key={id} className={ui.card}>
                <div className={ui.cardTitle}>
                  <span>
                    <span className={ui.icon}>
                      <ItemIcon icon={tool.icon} />
                    </span> {tool.name}
                  </span>
                  <span>
                    Level {level} of {MAX_TOOL_LEVEL}
                  </span>
                </div>
                <p className={ui.note}>Now: {tool.effects[level - 1]}</p>
                {cost ? (
                  <>
                    <p className={ui.note}>Next: {tool.effects[level]}</p>
                    <div className={ui.spread}>
                      <span className={`${ui.small} ${canAfford(cost) ? ui.good : ui.warn}`}>
                        {formatCost(cost)}
                        {!canAfford(cost) && ` (need ${formatCost(missing)} more)`}
                      </span>
                      <button
                        className={`${ui.text} ${canAfford(cost) ? ui.primary : ''}`}
                        onClick={() => upgradeTool(id)}
                        disabled={!canAfford(cost)}
                      >
                        Upgrade
                      </button>
                    </div>
                  </>
                ) : (
                  <p className={`${ui.note} ${ui.good}`}>Fully upgraded.</p>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="Make">
        <div className={ui.spread}>
          <span className={ui.p}>
            <ItemIcon icon="pot" /> Planter pot <span className={ui.muted}>· {formatCost(POT_COST)}</span>
          </span>
          <button className={ui.text} onClick={craftPot} disabled={!canAfford(POT_COST)}>
            Make pot
          </button>
        </div>
      </Section>
    </Dialog>
  );
}
