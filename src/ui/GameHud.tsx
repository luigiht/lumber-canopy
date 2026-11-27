'use client';

import { useEffect, useRef } from 'react';
import { useGame } from '@/game/store';
import { MATERIALS, parsePlantItem } from '@/game/items';
import { TOOLS, TOOL_IDS } from '@/game/tools';
import { STATIONS } from '@/config/stations';
import { SPECIES } from '@/game/plants';
import { isFriend } from '@/game/otter';
import {
  TUTORIAL_STEPS,
  cast,
  currentGoal,
  reel,
  finishTutorial,
  openPanel,
  selectTool,
  stopFishing,
} from '@/game/actions';
import { ItemIcon } from './ItemIcon';
import hud from './hud.module.css';
import ui from './ui.module.css';

/** Key resource counts at a glance. */
export function ResourceBar() {
  const inventory = useGame((s) => s.inventory);
  const coins = useGame((s) => s.coins);
  const n = (id: string) => inventory[id] ?? 0;
  const starts = Object.entries(inventory).reduce((sum, [id, c]) => {
    const p = parsePlantItem(id);
    return p && p.kind !== 'plant' ? sum + c : sum;
  }, 0);
  const chips: [string, string, number][] = [
    [MATERIALS.driftwood.icon, 'Driftwood', n('driftwood')],
    [MATERIALS.scrapWood.icon, 'Scrap wood', n('scrapWood')],
    [MATERIALS.stone.icon, 'Stones', n('stone')],
    [MATERIALS.metal.icon, 'Metal scraps', n('metal')],
    [MATERIALS.soil.icon, 'Soil', n('soil')],
    [MATERIALS.rope.icon, 'Rope', n('rope')],
    ['sprout', 'Seeds and cuttings', starts],
    ['coin', 'Coins', coins],
  ];
  return (
    <div className={`${hud.panel} ${ui.resources}`} aria-label="Materials">
      {chips.map(([icon, label, value]) => (
        <span key={label} className={ui.chip} title={label} aria-label={`${label}: ${value}`}>
          <span className={ui.icon} aria-hidden="true">
            <ItemIcon icon={icon} />
          </span>
          {value}
        </span>
      ))}
    </div>
  );
}

/** Tool slots (1, 2, 3), plus the bag and plants buttons. */
export function ToolBar() {
  const selected = useGame((s) => s.selectedTool);
  const tools = useGame((s) => s.tools);
  return (
    <div className={`${hud.panel} ${ui.toolbar}`} role="toolbar" aria-label="Tools">
      {TOOL_IDS.map((id) => {
        const t = TOOLS[id];
        const level = tools[id];
        return (
          <button
            key={id}
            className={selected === id ? hud.active : undefined}
            aria-pressed={selected === id}
            aria-label={`${t.name}, level ${level} (${t.key}): ${t.effects[level - 1]}`}
            title={`${t.name} L${level}: ${t.effects[level - 1]}`}
            onClick={() => selectTool(id)}
          >
            <span className={ui.toolKey} aria-hidden="true">
              {t.key}
            </span>
            <span className={ui.icon} aria-hidden="true">
              <ItemIcon icon={t.icon} />
            </span>
          </button>
        );
      })}
      <span className={ui.divider} aria-hidden="true" />
      <button aria-label="Inventory (I)" title="Inventory (I)" onClick={() => openPanel('inventory')}>
        <span className={ui.toolKey} aria-hidden="true">
          I
        </span>
        <span className={ui.icon} aria-hidden="true">
          <ItemIcon icon="backpack" />
        </span>
      </button>
      <button aria-label="Plants (P)" title="Plants (P)" onClick={() => openPanel('plants')}>
        <span className={ui.toolKey} aria-hidden="true">
          P
        </span>
        <span className={ui.icon} aria-hidden="true">
          <ItemIcon icon="potted" />
        </span>
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  return (
    <div className={ui.toasts} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`${hud.panel} ${ui.toast} ${t.tone === 'rare' ? ui.rare : t.tone === 'warn' ? ui.warn : ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

const MARKER_ICON: Record<string, string> = {
  door: 'door',
  exit: 'door',
  stairsUp: 'stairs',
  stairsDown: 'stairs',
  bed: 'moon',
  slot: 'pot',
  fishing: 'rod',
  rocks: 'stone',
  compost: 'soil',
  potting: 'sprout',
  workbench: 'hammer',
  delivery: 'box',
};

/** Floating buttons over everything the player can use; clicking one walks there. */
export function WorldMarkers() {
  const engine = useGame((s) => s.engine);
  const rocks = useGame((s) => s.rocks);
  const inside = useGame((s) => s.inside);
  const floor = useGame((s) => s.floor);
  const decor = useGame((s) => s.decor);
  const cabinDone = useGame((s) => s.build.phase === 'done');
  const otterFriend = useGame((s) => isFriend(s.otter.feeds));
  const otterBusy = useGame((s) => s.otterBusy);
  const shown = STATIONS.filter((s) => {
    if (s.area === 'inside') return inside && (s.floor ?? 0) === floor;
    if (inside) return false;
    return s.kind !== 'door' || cabinDone;
  });
  const refs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!engine) return;
    let raf = 0;
    const tick = () => {
      for (const [id, el] of refs.current) {
        const p = id === 'otter' ? engine.otterAnchor() : engine.stationAnchor(id);
        el.style.visibility = p ? 'visible' : 'hidden';
        if (p) el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return (
    <div className={ui.markerLayer}>
      {shown.map((s) => {
        const empty = s.kind === 'rocks' && rocks[Number(s.id.split(':')[1])]?.left <= 0;
        const planted = s.kind === 'slot' && s.slot !== undefined ? decor[s.slot] : null;
        const label = planted ? `${SPECIES[planted].name}: pick up or swap` : `${s.name}: ${s.hint}`;
        return (
          <button
            key={s.id}
            ref={(el) => {
              if (el) refs.current.set(s.id, el);
              else refs.current.delete(s.id);
            }}
            className={`${hud.worldButton} ${ui.marker} ${empty ? ui.dim : ''}`}
            style={{ animation: 'none' }}
            title={empty ? `${s.name}: empty, refills over time` : label}
            aria-label={empty ? `${s.name} (empty)` : label}
            onClick={() => engine?.goTo(s.id)}
          >
            <span className={ui.icon} aria-hidden="true">
              <ItemIcon icon={planted ? 'potted' : MARKER_ICON[s.kind]} />
            </span>
            <span className={ui.markerName}>{planted ? SPECIES[planted].name : s.hint}</span>
          </button>
        );
      })}
      {!inside && (
        <button
          ref={(el) => {
            if (el) refs.current.set('otter', el);
            else refs.current.delete('otter');
          }}
          className={`${hud.worldButton} ${ui.marker} ${otterBusy ? ui.dim : ''}`}
          style={{ animation: 'none' }}
          title={otterBusy ? 'Your otter is diving' : otterFriend ? 'Your otter friend: feed it a seed' : 'River otter: feed it seeds'}
          aria-label={otterFriend ? 'Your otter friend' : 'River otter'}
          onClick={() => engine?.goToOtter()}
        >
          <span className={ui.icon} aria-hidden="true">
            <ItemIcon icon="otter" />
          </span>
          <span className={ui.markerName}>{otterFriend ? 'Otter friend' : 'Feed the otter'}</span>
        </button>
      )}
    </div>
  );
}

/** Small progress bar over the player's head while gathering. */
export function TaskBar() {
  const engine = useGame((s) => s.engine);
  const wrap = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!engine) return;
    let raf = 0;
    const tick = () => {
      const task = engine.taskState;
      const p = task && task.mode === 'swing' ? engine.playerAnchor() : null;
      const el = wrap.current;
      if (el) {
        el.style.visibility = p ? 'visible' : 'hidden';
        if (p) el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
      }
      if (fill.current && task) fill.current.style.width = `${Math.min(1, task.progress) * 100}%`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [engine]);
  return (
    <div ref={wrap} className={ui.taskBar} aria-hidden="true">
      <div className={hud.progress}>
        <div ref={fill} className={hud.progressFill} />
      </div>
    </div>
  );
}

const TUTORIAL_TEXT: Record<(typeof TUTORIAL_STEPS)[number], { title: string; body: string }> = {
  move: { title: 'Walk', body: 'Click or tap the ground to walk there. Drag to turn the view, scroll or pinch to zoom.' },
  interact: {
    title: 'Use things',
    body: 'Floating markers show what you can use. Click the delivery box by the road (or any marker) to walk over and use it.',
  },
  inventory: { title: 'Inventory', body: 'Press I, or the backpack button, to open your inventory.' },
  tools: { title: 'Tools', body: 'Press 1, 2 or 3, or click a tool below, to switch between hammer, fishing rod and pickaxe.' },
};

/** The controls tutorial while it runs, then the current goal. */
export function Coach() {
  const tutorial = useGame((s) => s.tutorial);
  const arrived = useGame((s) => s.arrived);
  // On phones the fishing panel takes this spot, so the coach steps aside while fishing.
  const fishingClass = useGame((s) => (s.fishing ? ui.whileFishing : ''));
  useGame((s) => s.build);
  useGame((s) => s.inventory);
  useGame((s) => s.pots);
  useGame((s) => Math.floor(s.elapsed * 4));
  if (!arrived) return null;
  if (!tutorial.done) {
    const key = TUTORIAL_STEPS[tutorial.step];
    const step = TUTORIAL_TEXT[key];
    return (
      <div className={`${hud.panel} ${ui.coach} ${fishingClass}`} role="status" aria-live="polite">
        <div className={ui.spread}>
          <strong className={ui.heading}>
            {step.title} <span className={ui.muted}>· step {tutorial.step + 1} of {TUTORIAL_STEPS.length}</span>
          </strong>
          <button className={`${ui.link}`} onClick={() => finishTutorial(true)}>
            Skip tutorial
          </button>
        </div>
        <p className={ui.p}>{step.body}</p>
      </div>
    );
  }
  const goal = currentGoal();
  return goal ? (
    <div className={`${hud.panel} ${ui.goal} ${fishingClass}`} role="status" aria-live="polite">
      {goal}
    </div>
  ) : null;
}

/** Timing minigame: stop the marker inside the green zone to hook the floating debris. */
export function FishingGame() {
  const fishing = useGame((s) => s.fishing);
  const cursor = useRef<HTMLDivElement>(null);
  const pos = useRef(0);

  useEffect(() => {
    if (fishing?.phase !== 'bite') return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      // Ping-pong across the bar, about 1.3 s per sweep.
      const t = ((now - t0) / 1300) % 2;
      pos.current = t < 1 ? t : 2 - t;
      if (cursor.current) cursor.current.style.left = `${pos.current * 100}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fishing?.phase]);

  useEffect(() => {
    if (!fishing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      // A focused button handles Space/Enter itself.
      if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;
      e.preventDefault();
      const f = useGame.getState().fishing;
      if (f?.phase === 'bite') reel(pos.current);
      else if (f?.phase === 'result') cast();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fishing]);

  if (!fishing) return null;
  return (
    <div className={`${hud.panel} ${ui.fishing}`} role="group" aria-label="Fishing">
      <div className={ui.spread}>
        <span className={ui.heading}>
          <ItemIcon icon="rod" /> Fishing for debris
        </span>
        <button className={ui.text} onClick={stopFishing}>
          Stop
        </button>
      </div>
      {fishing.phase === 'waiting' && <p className={ui.p}>Waiting for something to drift by…</p>}
      {fishing.phase === 'bite' && (
        <>
          <p className={ui.p}>Something’s floating past! Reel in when the marker is in the green.</p>
          <div className={ui.fishBar} onPointerDown={() => reel(pos.current)}>
            <div
              className={ui.fishZone}
              style={{ left: `${fishing.zoneStart * 100}%`, width: `${fishing.zoneWidth * 100}%` }}
            />
            <div ref={cursor} className={ui.fishCursor} />
          </div>
          <button className={`${ui.text} ${ui.primary}`} onClick={() => reel(pos.current)}>
            Reel in (Space)
          </button>
        </>
      )}
      {fishing.phase === 'result' && (
        <>
          <p className={`${ui.p} ${fishing.result?.ok ? ui.good : ui.warn}`} aria-live="assertive">
            {fishing.result?.text}
          </p>
          <button className={`${ui.text} ${ui.primary}`} onClick={() => cast()}>
            Cast again (Space)
          </button>
        </>
      )}
    </div>
  );
}
