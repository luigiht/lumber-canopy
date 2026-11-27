'use client';

import { useEffect, useRef } from 'react';
import { Engine } from '@/engine/Engine';
import { Hud } from '@/ui/Hud';
import { SPEEDS, useGame } from './store';
import { interact, onBuild, payStage, stopFishing, tickWorld, toast, tutorialEvent } from './actions';
import { initSession, onArrivalDone } from './session';
import { loadDisplay } from './display';
import { ROCK_MAX } from './save';
import { potStage } from './plants';
import { fieldBeds } from '@/config/field';

export default function Game() {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const engine = new Engine(el, {
      onHour: (hour, day, elapsed) => {
        useGame.setState({ hour, day, elapsed });
        tickWorld(elapsed);
      },
      onRotate: (quarter) => useGame.setState({ quarter }),
      onBuild,
      payStage,
      onArrive: interact,
      onWalk: () => {
        tutorialEvent('move');
        if (useGame.getState().fishing) stopFishing();
      },
      onGate: () => toast('Finish the quick tutorial (or skip it) before crossing the bridge.', 'warn'),
      onArrivalDone,
      onArea: (inside, floor) => useGame.setState({ inside, floor, panel: null }),
      onTaskCancel: () => {
        if (useGame.getState().fishing) stopFishing();
      },
    });
    engine.setSpeed(SPEEDS[useGame.getState().speedIndex].hoursPerSec);
    useGame.setState({ engine, ready: true });
    loadDisplay();
    // Handy for debugging from the console.
    (window as unknown as { __engine?: Engine }).__engine = engine;

    // Keep the world in step with the game state: stone piles, plants on display, pots on the table.
    const syncWorld = () => {
      const s = useGame.getState();
      engine.stations.setRocks(s.rocks.map((n) => ({ left: n.left, max: ROCK_MAX })));
      engine.stations.setDecor(s.decor, s.build.phase === 'done');
      engine.interior.setDecor(s.decor);
      engine.stations.setTablePots(s.pots.map((p) => ({ species: p.species, stage: potStage(p, s.elapsed) })));
      engine.stations.setField(
        fieldBeds(s.field.level),
        s.field.beds.map((b) => (b ? { species: b.species, stage: potStage(b, s.elapsed) } : null)),
      );
    };
    syncWorld();
    const unsubscribe = useGame.subscribe((s, prev) => {
      if (s.rocks !== prev.rocks || s.decor !== prev.decor || s.pots !== prev.pots || s.field !== prev.field || s.elapsed !== prev.elapsed || s.build.phase !== prev.build.phase)
        syncWorld();
    });

    void initSession();
    return () => {
      unsubscribe();
      useGame.setState({ engine: null, ready: false });
      engine.dispose();
    };
  }, []);

  return (
    <main style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <div ref={mount} style={{ position: 'absolute', inset: 0 }} />
      <Hud />
    </main>
  );
}
