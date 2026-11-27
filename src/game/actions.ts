import { useGame, type BuildState, type Panel } from './store';
import { CABIN } from '@/config/cabin';
import { DECOR_SLOTS, TABLE_SLOTS, slotPlace, stationById } from '@/config/stations';
import { formatCost, itemDef, type Cost, type ItemId } from './items';
import { rollCatch, rollOtterFind } from './loot';
import { FRIEND_FEEDS, OTTER_LEVELS, isFriend, otterLevel } from './otter';
import { SEED_FACTOR, SPECIES, potStage, type SpeciesId } from './plants';
import { COMPOST_MAX, COMPOST_REFILL_HOURS, ROCK_MAX, ROCK_REFILL_HOURS, type NodeState } from './save';
import { MAX_TOOL_LEVEL, TOOLS, TOOL_STATS, levelIndex, type ToolId } from './tools';
import { requestSave } from './session';

/* Game rules: everything the player does goes through here, and changes the store. */

const get = useGame.getState;
const set = useGame.setState;

// ---- Messages ---------------------------------------------------------------------------------

let toastId = 0;
export function toast(text: string, tone: 'info' | 'good' | 'rare' | 'warn' = 'info') {
  const id = ++toastId;
  set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === 'rare' ? 5500 : 3800);
}

/** One-time hints, remembered for this session. */
const shown = new Set<string>();
function once(key: string, text: string, tone: 'info' | 'good' = 'info') {
  if (shown.has(key)) return;
  shown.add(key);
  toast(text, tone);
}

// ---- Inventory --------------------------------------------------------------------------------

export const count = (id: string) => get().inventory[id] ?? 0;

export function missingFor(cost: Cost): Cost {
  const s = get();
  const out: Cost = {};
  for (const [id, n] of Object.entries(cost) as [keyof Cost, number][]) {
    const have = id === 'coins' ? s.coins : (s.inventory[id] ?? 0);
    if (have < n) out[id] = n - have;
  }
  return out;
}

export const canAfford = (cost: Cost) => Object.keys(missingFor(cost)).length === 0;

function spend(cost: Cost) {
  if (!canAfford(cost)) return false;
  set((s) => {
    const inventory = { ...s.inventory };
    let coins = s.coins;
    for (const [id, n] of Object.entries(cost) as [keyof Cost, number][]) {
      if (id === 'coins') coins -= n;
      else inventory[id] = (inventory[id] ?? 0) - n;
      if (id !== 'coins' && inventory[id] <= 0) delete inventory[id];
    }
    return { inventory, coins };
  });
  return true;
}

function give(items: Partial<Record<string, number>>) {
  set((s) => {
    const inventory = { ...s.inventory };
    for (const [id, n] of Object.entries(items)) if (n) inventory[id] = (inventory[id] ?? 0) + n;
    return { inventory };
  });
}

// ---- Tools ------------------------------------------------------------------------------------

export function selectTool(id: ToolId) {
  if (id !== 'rod' && get().fishing) stopFishing();
  if (get().selectedTool !== id) set({ selectedTool: id });
  get().engine?.setTool(id);
  tutorialEvent('tools');
}

export function upgradeTool(id: ToolId) {
  const level = get().tools[id];
  if (level >= MAX_TOOL_LEVEL) return;
  const cost = TOOLS[id].upgrades[level - 1];
  if (!spend(cost)) {
    toast(`Not enough yet. You still need ${formatCost(missingFor(cost))}.`, 'warn');
    return;
  }
  set((s) => ({ tools: { ...s.tools, [id]: level + 1 } }));
  if (id === 'hammer') get().engine?.setBuildSpeed(TOOL_STATS.hammer.buildSpeed[levelIndex(level + 1)]);
  toast(`${TOOLS[id].name} upgraded to level ${level + 1}: ${TOOLS[id].effects[level]}.`, 'good');
  requestSave();
}

export const POT_COST: Cost = { scrapWood: 2 };

export function craftPot() {
  if (!spend(POT_COST)) {
    toast(`A pot needs ${formatCost(POT_COST)}.`, 'warn');
    return;
  }
  give({ pot: 1 });
  toast('Made a planter pot from scrap wood.', 'good');
  requestSave();
}

// ---- Panels and the tutorial ------------------------------------------------------------------

export function openPanel(panel: Panel) {
  set({ panel });
  if (panel === 'inventory') tutorialEvent('inventory');
}

export const TUTORIAL_STEPS = ['move', 'interact', 'inventory', 'tools'] as const;
export type TutorialEvent = (typeof TUTORIAL_STEPS)[number];

export function tutorialEvent(kind: TutorialEvent) {
  const { tutorial, arrived } = get();
  if (tutorial.done || !arrived || TUTORIAL_STEPS[tutorial.step] !== kind) return;
  const step = tutorial.step + 1;
  if (step >= TUTORIAL_STEPS.length) finishTutorial();
  else set({ tutorial: { done: false, step } });
}

export function finishTutorial(skipped = false) {
  set({ tutorial: { done: true, step: TUTORIAL_STEPS.length } });
  get().engine?.setGate(false);
  toast(skipped ? 'Tutorial skipped. The bridge is open.' : 'Nicely done! Cross the bridge to your plot.', 'good');
  requestSave();
}

// ---- Stations ---------------------------------------------------------------------------------

/** The player arrived at a station: do what it's for. */
export function interact(stationId: string) {
  if (stationId === 'otter') {
    tutorialEvent('interact');
    openPanel('otter');
    return;
  }
  const def = stationById(stationId);
  if (!def) return;
  tutorialEvent('interact');
  switch (def.kind) {
    case 'fishing':
      startFishing();
      break;
    case 'rocks':
      gatherRock(Number(stationId.split(':')[1]));
      break;
    case 'compost':
      gatherSoil();
      break;
    case 'door':
      if (get().build.phase !== 'done') toast('Finish building the cabin first.');
      else {
        get().engine?.enterInterior();
        once('inside', 'Welcome home! Click a saucer to place a plant in each room.', 'good');
      }
      break;
    case 'exit':
      get().engine?.exitInterior();
      break;
    case 'stairsUp':
      get().engine?.setFloor(1);
      break;
    case 'stairsDown':
      get().engine?.setFloor(0);
      break;
    case 'bed':
      openPanel('bed');
      break;
    case 'slot':
      set({ placeSlot: def.slot ?? null });
      openPanel('place');
      break;
    default:
      openPanel(def.kind);
  }
}

function startNodeRefill(node: NodeState, take: number, hours: number): NodeState {
  const left = node.left - take;
  return { left, refillAt: node.refillAt || get().elapsed + hours };
}

const hoursText = (h: number) => (h < 1 ? 'less than an hour' : `about ${Math.ceil(h)} in-game hours`);

export function gatherRock(index: number) {
  const s = get();
  const node = s.rocks[index];
  const engine = s.engine;
  if (!node || !engine) return;
  if (node.left <= 0) {
    toast(`Picked clean. The river will wash more stones here in ${hoursText(node.refillAt - s.elapsed)}.`);
    return;
  }
  const withPick = s.selectedTool === 'pickaxe';
  const li = levelIndex(s.tools.pickaxe);
  const seconds = withPick ? TOOL_STATS.pickaxe.seconds[li] : TOOL_STATS.hands.seconds;
  const amount = withPick
    ? TOOL_STATS.pickaxe.amount[li] + (Math.random() < TOOL_STATS.pickaxe.bonusChance[li] ? 1 : 0)
    : TOOL_STATS.hands.amount;
  if (!withPick) once('pickaxe', 'Tip: hold the pickaxe (3) to gather stones faster.');
  engine.setTool(withPick ? 'pickaxe' : null);
  engine.work(`rocks:${index}`, seconds, () => {
    const now = get();
    const n = now.rocks[index];
    const take = Math.min(amount, n.left);
    const rocks = now.rocks.slice();
    rocks[index] = startNodeRefill(n, take, ROCK_REFILL_HOURS);
    set({ rocks, stats: { ...now.stats, gathered: now.stats.gathered + take } });
    give({ stone: take });
    toast(`+${take} Stones`, 'good');
    once('stones', 'You’re gathering loose stones carried by the river, not damaging the landscape.');
    engine.setTool(get().selectedTool);
    requestSave(4000);
    // Keep gathering while the player stays put.
    if (rocks[index].left > 0) gatherRock(index);
    else toast('This pile is empty for now. It refills over time.');
  });
}

export function gatherSoil() {
  const s = get();
  const engine = s.engine;
  if (!engine) return;
  if (s.compost.left <= 0) {
    toast(`The compost needs time. More soil in ${hoursText(s.compost.refillAt - s.elapsed)}.`);
    return;
  }
  engine.setTool(null);
  engine.work('compost', 2, () => {
    const now = get();
    set({ compost: startNodeRefill(now.compost, 1, COMPOST_REFILL_HOURS) });
    give({ soil: 1 });
    toast('+1 Soil', 'good');
    engine.setTool(get().selectedTool);
    requestSave(4000);
    if (get().compost.left > 0) gatherSoil();
  });
}

/** Refills stone piles and the compost heap once their time comes. Called as the clock moves. */
export function tickWorld(elapsed: number) {
  const s = get();
  const due = (n: NodeState) => n.refillAt > 0 && elapsed >= n.refillAt;
  if (s.rocks.some(due)) set({ rocks: s.rocks.map((n) => (due(n) ? { left: ROCK_MAX, refillAt: 0 } : n)) });
  if (due(s.compost)) set({ compost: { left: COMPOST_MAX, refillAt: 0 } });
}

// ---- Fishing ----------------------------------------------------------------------------------

let biteTimer: ReturnType<typeof setTimeout> | undefined;

function startFishing() {
  selectTool('rod');
  get().engine?.fish('fishing');
  once('fishing', 'Only floating debris here. No fish are ever caught.');
  cast();
}

/** Throws the line and waits for something to drift by. */
export function cast() {
  const s = get();
  clearTimeout(biteTimer);
  const readyAt = s.fishing?.readyAt ?? 0;
  set({ fishing: { phase: 'waiting', zoneStart: 0, zoneWidth: 0, readyAt } });
  const wait = Math.max(0, readyAt - performance.now()) + 700 + Math.random() * 1300;
  biteTimer = setTimeout(() => {
    const f = get().fishing;
    if (!f) return;
    const width = TOOL_STATS.rod.zone[levelIndex(get().tools.rod)];
    set({ fishing: { ...f, phase: 'bite', zoneWidth: width, zoneStart: 0.08 + Math.random() * (0.84 - width) } });
  }, wait);
}

/** Reels in with the marker at `pos` (0..1 along the bar). */
export function reel(pos: number) {
  const s = get();
  const f = s.fishing;
  if (!f || f.phase !== 'bite') return;
  const ok = pos >= f.zoneStart && pos <= f.zoneStart + f.zoneWidth;
  const readyAt = performance.now() + TOOL_STATS.rod.cooldown[levelIndex(s.tools.rod)] * 1000;
  if (!ok) {
    set({ fishing: { ...f, phase: 'result', readyAt, result: { ok: false, text: 'It drifted past. Try again!' } } });
    return;
  }
  const c = rollCatch(s.tools.rod);
  give({ [c.item]: c.amount });
  set({ stats: { ...s.stats, fished: s.stats.fished + 1 } });
  const name = itemDef(c.item).name;
  const text = c.rarity === 'rare' ? `Rare find! A bottle with ${name}.` : `Caught ${c.amount} × ${name}`;
  set({ fishing: { ...f, phase: 'result', readyAt, result: { ok: true, text } } });
  if (c.rarity === 'rare') toast(text, 'rare');
  requestSave(4000);
}

export function stopFishing() {
  clearTimeout(biteTimer);
  if (get().fishing) set({ fishing: null });
  const engine = get().engine;
  if (engine?.taskState?.mode === 'fish') engine.stopTask();
}

// ---- Sleep ------------------------------------------------------------------------------------

/** Wake-up time: just after sunrise. */
export const WAKE_HOUR = 7;

/**
 * Goes to bed: the screen fades to black, the clock moves on to the next 07:00 (plants grow and
 * piles refill as the hours pass), then the morning fades in.
 */
export function goToSleep() {
  const s = get();
  const engine = s.engine;
  if (!engine || s.sleep) return;
  set({ panel: null, sleep: 'falling' });
  engine.inputLocked = true;
  setTimeout(() => {
    const hours = engine.sleepUntil(WAKE_HOUR);
    tickWorld(get().elapsed);
    set({ sleep: 'waking' });
    setTimeout(() => {
      set({ sleep: null });
      engine.inputLocked = false;
      toast(`Good morning! You slept ${Math.round(hours)} hours. It’s day ${get().day}.`, 'good');
      requestSave(0);
    }, 1600);
  }, 1300);
}

// ---- Otter ------------------------------------------------------------------------------------

/** Feeds the otter one seed: friendship grows, and a friend dives for something from the river. */
export function feedOtter(seedId: ItemId) {
  const s = get();
  const engine = s.engine;
  if (!engine) return;
  if (s.otterBusy) {
    toast('The otter is off diving. It’ll be back soon.');
    return;
  }
  if (!seedId.startsWith('seed:') || !spend({ [seedId]: 1 })) return;
  const before = s.otter.feeds;
  const feeds = before + 1;
  set({ otter: { feeds } });
  if (!isFriend(feeds)) {
    const left = FRIEND_FEEDS - feeds;
    toast(`The otter munches the seed happily. ${left} more and it’ll trust you.`, 'good');
  } else {
    if (!isFriend(before)) {
      engine.setOtterFriend(true);
      toast('The otter is your friend! It’ll follow you now, and dive for treasures when you feed it.', 'rare');
    } else if (otterLevel(feeds) > otterLevel(before)) {
      toast(`Your otter is now your ${OTTER_LEVELS[otterLevel(feeds) - 1].name.toLowerCase()}: it finds rarer things!`, 'rare');
    }
    set({ otterBusy: true, panel: null });
    engine.otterFetch(onOtterFind);
  }
  requestSave();
}

/** The otter is back from the river with a find. */
function onOtterFind() {
  const s = get();
  const level = OTTER_LEVELS[Math.max(0, otterLevel(s.otter.feeds) - 1)];
  const c = rollOtterFind(level);
  give({ [c.item]: c.amount });
  set({ otterBusy: false });
  const name = itemDef(c.item).name;
  toast(
    c.rarity === 'rare' ? `The otter found something special: ${name}!` : `The otter brought you ${c.amount} × ${name}.`,
    c.rarity === 'rare' ? 'rare' : 'good',
  );
  requestSave(4000);
}

// ---- Plants -----------------------------------------------------------------------------------

export const placedCount = () => get().decor.filter(Boolean).length;

/** Pots the potting table holds; every 4 plants on display adds one, up to the table's size. */
export const tableCapacity = () => Math.min(TABLE_SLOTS.length, 3 + Math.floor(placedCount() / 4));

export function plant(itemId: ItemId) {
  const s = get();
  const [kind, species] = itemId.split(':') as ['seed' | 'cutting', SpeciesId];
  if (s.pots.length >= tableCapacity()) {
    toast('The potting table is full. Place or pot up a mature plant first.', 'warn');
    return;
  }
  const cost: Cost = { pot: 1, soil: 1, [itemId]: 1 };
  if (!spend(cost)) {
    toast(`Planting needs ${formatCost(missingFor(cost))} more.`, 'warn');
    return;
  }
  const sp = SPECIES[species];
  const pot = {
    id: s.nextPotId,
    species,
    plantedAt: s.elapsed,
    hours: sp.hours * (kind === 'seed' ? SEED_FACTOR : 1),
    from: kind,
  };
  set((st) => ({
    pots: [...st.pots, pot],
    nextPotId: st.nextPotId + 1,
    stats: { ...st.stats, planted: st.stats.planted + 1 },
  }));
  toast(`Planted a ${sp.name} ${kind}. Ready in ${Math.round(pot.hours)} in-game hours.`, 'good');
  requestSave();
}

function takeMaturePot(potId: number) {
  const s = get();
  const pot = s.pots.find((p) => p.id === potId);
  if (!pot || potStage(pot, s.elapsed) !== 3) return null;
  return pot;
}

/** Moves a mature plant from the table into the bag, freeing the slot. */
export function potUp(potId: number) {
  const pot = takeMaturePot(potId);
  if (!pot) return;
  set((s) => ({ pots: s.pots.filter((p) => p.id !== potId) }));
  give({ [`plant:${pot.species}`]: 1 });
  toast(`${SPECIES[pot.species].name} is in your bag.`, 'good');
  requestSave();
}

/** Propagates a mature plant: cuttings for new pots, and the plant regrows a little. */
export function takeCuttings(potId: number) {
  const pot = takeMaturePot(potId);
  if (!pot) return;
  const sp = SPECIES[pot.species];
  set((s) => ({
    pots: s.pots.map((p) => (p.id === potId ? { ...p, plantedAt: s.elapsed - p.hours * 0.55 } : p)),
    stats: { ...s.stats, propagated: s.stats.propagated + 1 },
  }));
  give({ [`cutting:${pot.species}`]: sp.cuttings });
  toast(`Propagated! +${sp.cuttings} ${sp.name} cuttings.`, 'good');
  requestSave();
}

/** First empty spot: inside the cabin once it's built (then the porch), otherwise the garden. */
function freeDecorSlot() {
  const s = get();
  const done = s.build.phase === 'done';
  const free = (i: number) => !s.decor[i];
  const order = DECOR_SLOTS.map((_, i) => i).filter((i) => done || (!DECOR_SLOTS[i].porch && !DECOR_SLOTS[i].interior));
  if (done) order.sort((a, b) => Number(!DECOR_SLOTS[a].interior) - Number(!DECOR_SLOTS[b].interior));
  return order.find(free) ?? -1;
}

/**
 * Puts a plant on display: in a chosen spot, or the first free one (inside the cabin once it's
 * built, then the porch, otherwise around the garden).
 */
export function placePlant(species: SpeciesId, fromPot?: number, at?: number) {
  const slot = at ?? freeDecorSlot();
  if (at !== undefined && get().decor[at]) {
    toast('There’s already a plant there.', 'warn');
    return;
  }
  if (slot < 0) {
    toast(get().build.phase === 'done' ? 'Every spot is filled. What a cabin!' : 'Garden spots are full. Finish the cabin to open the porch.', 'warn');
    return;
  }
  if (fromPot !== undefined) {
    if (!takeMaturePot(fromPot)) return;
    set((s) => ({ pots: s.pots.filter((p) => p.id !== fromPot) }));
  } else if (!spend({ [`plant:${species}`]: 1 })) return;
  const before = tableCapacity();
  set((s) => {
    const decor = s.decor.slice();
    decor[slot] = species;
    return { decor };
  });
  const ds = DECOR_SLOTS[slot];
  const where = ds.interior ? `in the ${slotPlace(slot).toLowerCase()}` : ds.porch ? 'on the porch' : 'in the garden';
  toast(`Placed a ${SPECIES[species].name} ${where}.`, 'good');
  if (tableCapacity() > before) toast('Your cabin is getting cozy: the potting table now holds one more pot!', 'rare');
  requestSave();
}

/** Takes a displayed plant back into the bag. */
export function pickUpPlant(slot: number) {
  const sp = get().decor[slot];
  if (!sp) return;
  set((s) => {
    const decor = s.decor.slice();
    decor[slot] = null;
    return { decor };
  });
  give({ [`plant:${sp}`]: 1 });
  requestSave();
}

export function sellPlant(species: SpeciesId, mode: 'coins' | 'trade') {
  if (!spend({ [`plant:${species}`]: 1 })) return;
  const sp = SPECIES[species];
  if (mode === 'coins') set((s) => ({ coins: s.coins + sp.price }));
  else give(sp.trade);
  set((s) => ({ stats: { ...s.stats, sold: s.stats.sold + 1 } }));
  toast(
    mode === 'coins' ? `Sold a ${sp.name} for ${sp.price} coins.` : `Traded a ${sp.name} for ${formatCost(sp.trade as Cost)}.`,
    'good',
  );
  requestSave();
}

// ---- Cabin ------------------------------------------------------------------------------------

export const stageCost = (stageIndex: number): Cost => (CABIN.stages[stageIndex]?.cost ?? {}) as Cost;

/** The engine asks to start a stage: use its materials if the player has them. */
export function payStage(stageIndex: number) {
  const cost = stageCost(stageIndex);
  if (!spend(cost)) return false;
  selectTool('hammer');
  toast(`Used ${formatCost(cost)} for the ${CABIN.stages[stageIndex].name.toLowerCase()}.`);
  requestSave();
  return true;
}

export function goBuild() {
  const engine = get().engine;
  if (!engine) return;
  selectTool('hammer');
  engine.goBuild();
}

/** React to build updates from the engine: save on each stage, celebrate the finish. */
export function onBuild(build: BuildState) {
  const prev = get().build;
  set({ build });
  if (prev.stageCount === 0) return; // first report after load
  if (build.phase === 'done' && prev.phase !== 'done') {
    toast('Cabin built! The porch is ready for plants.', 'rare');
    requestSave();
  } else if (build.stageNumber !== prev.stageNumber) requestSave();
}

/** What to do next, shown under the calendar once the tutorial is done. */
export function currentGoal(): string | null {
  const s = get();
  if (!s.arrived || !s.tutorial.done) return null;
  if (s.build.phase !== 'done') {
    const missing = s.build.stagePaid ? {} : missingFor(stageCost(s.build.stageNumber - 1));
    const ids = Object.keys(missing);
    if (ids.length) {
      const where = ids.includes('stone') && ids.length === 1 ? 'Gather loose stones' : ids.includes('stone') ? 'Fish and gather' : 'Fish the river';
      return `${where} for the ${s.build.stageName.toLowerCase() || 'cabin'}: ${formatCost(missing)}`;
    }
    return s.build.phase === 'plot' ? 'You have the materials: click “Build cabin” at the plot.' : 'Keep building your cabin.';
  }
  if (s.pots.some((p) => potStage(p, s.elapsed) === 3)) return 'A plant is ready! Place it, take cuttings, or pot it up.';
  const insideSlots = DECOR_SLOTS.map((d, i) => (d.interior ? i : -1)).filter((i) => i >= 0);
  const inside = insideSlots.filter((i) => s.decor[i]).length;
  const bagPlants = Object.keys(s.inventory).some((id) => id.startsWith('plant:') && s.inventory[id] > 0);
  if (inside < insideSlots.length && bagPlants)
    return s.inside
      ? `Click a saucer to place a plant: ${inside} of ${insideSlots.length} spots filled.`
      : `Go inside your cabin and place your plants: ${inside} of ${insideSlots.length} spots filled.`;
  const placed = placedCount();
  if (placed >= DECOR_SLOTS.length) return 'Your cabin is full of plants. Keep propagating and upgrading!';
  if (!s.pots.length) return 'Plant a cutting or seeds at the potting table.';
  return `Fill your cabin with plants: ${inside} of ${insideSlots.length} inside, ${placed} of ${DECOR_SLOTS.length} in all.`;
}
