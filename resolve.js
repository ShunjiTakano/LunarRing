// Lunar Ring - automatic resolve tracking.
// - At the start of your turn, resolve is set to your Devotee's maximum
//   (read from the "cost" field of your current Devotee card).
// - When a card leaves your hand, its cost is subtracted from your resolve.
// Resolve is tracked in game.data.ResolveHelper.current and mirrored onto
// Counter 2 (index 1), because scripts cannot read the counter directly.

// Set resolve (tracked value + on-screen counter). Clamped to 0-10.
async function setResolve(value) {
  const v = Math.max(0, Math.min(10, Math.floor(Number(value) || 0)));
  game.data.ResolveHelper.current = v;
  await functions.changeCounterValue(1, v);
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// Devotee condition cards still on the board, best condition first.
// Worsened conditions are discarded, so Thriving > Wounded > Desperate.
function getDevotees() {
  const rank = { Thriving: 0, Wounded: 1, Desperate: 2 };
  const list = [];
  for (const card of (cards.Devotee ?? [])) {
    const data = functions.getCardData(card);
    const r = rank[data?.condition];
    if (r === undefined) continue;
    // Ignore conditions we have already passed, even if the board still lists them.
    if (r < (Number(game.data.ResolveHelper.rank) || 0)) continue;
    list.push({ rank: r, card: card, data: data });
  }
  list.sort(function (a, b) { return a.rank - b.rank; });
  return list;
}

// Resolve maximum = "cost" of the current Devotee condition.
function getResolveMax() {
  const list = getDevotees();
  if (list.length === 0) return null;
  return clamp(Number(list[0].data.cost) || 0, 0, 10);
}

// ---------- Health ----------
// Health is tracked in game.data.ResolveHelper.health and mirrored onto
// Counter 1 (index 0). Change it with changeHealth()/setHealth(), not by
// clicking the on-screen counter.

async function setHealthDisplay(v) {
  game.data.ResolveHelper.health = v;
  await functions.changeCounterValue(0, Math.max(0, v));
}

// Start of game: full health of the Thriving condition.
async function initHealth() {
  const rh = game.data.ResolveHelper;
  rh.rank = 0;
  const list = getDevotees();
  if (list.length === 0) return;
  rh.healthInit = true;
  rh.condition = list[0].data.condition;
  rh.max = clamp(Number(list[0].data.cost) || 0, 0, 10);
  const startHealth = Number(list[0].data.health) || 0;
  functions.chatLog('starts at ' + startHealth + ' health as ' + list[0].data.condition + ' (found ' + list.length + ' Devotee cards)');
  await setHealthDisplay(startHealth);
}

// Set health. Damage past 0 worsens the condition and carries over.
async function setHealth(value) {
  const rh = game.data.ResolveHelper;
  const list = getDevotees();
  let v = Math.floor(Number(value) || 0);
  if (list.length === 0) { await setHealthDisplay(v); return; }

  // Restoring never goes above the current condition's health.
  const cap = Number(list[0].data.health) || 0;
  if (v > cap) v = cap;

  let i = 0;
  while (v <= 0 && i < list.length - 1) {
    const carry = -v;
    await functions.moveCard(list[i].card, 'Discard', { noLogs: true });
    i++;
    const next = list[i].data;
    rh.condition = next.condition;
    rh.rank = list[i].rank;
    rh.max = clamp(Number(next.cost) || 0, 0, 10);
    functions.chatLog('worsens to ' + next.condition);
    await setResolve(rh.max); // resolve is set to the new maximum immediately
    v = (Number(next.health) || 0) - carry;
  }
  if (v <= 0) {
    v = 0;
    functions.chatLog('is at 0 health in ' + list[i].data.condition + ' and is eliminated');
  }
  await setHealthDisplay(v);
}

// sign: -1 = take damage, +1 = restore health. Amount comes from the panel.
async function changeHealth(sign) {
  const rh = game.data.ResolveHelper;
  const amount = Math.floor(Number(rh.amount) || 0);
  if (amount <= 0) return;
  if (sign < 0) functions.chatLog('takes ' + amount + ' damage');
  else functions.chatLog('restores ' + amount + ' health');
  await setHealth((Number(rh.health) || 0) + sign * amount);
}

async function refillResolve() {
  if (!game.data.ResolveHelper.healthInit) await initHealth();
  const max = getResolveMax();
  if (max === null) return;
  game.data.ResolveHelper.max = max;
  await setResolve(max);
  functions.chatLog('restores resolve to ' + max);
}

// Runs on every new turn for every player. game.turn.isMyTurn can still hold the
// PREVIOUS turn's value when this event fires, so we count turn events ourselves:
// event 1 is the first player's turn, event 2 the next player's, and so on.
async function onMyNewTurn() {
  const rh = game.data.ResolveHelper;
  rh.turnSeq = (Number(rh.turnSeq) || 0) + 1;
  const total = Number(game.turn.totalPlayers) || 2;
  const pos = Number(game.turn.orderPosition) || 0;
  const mine = ((rh.turnSeq - 1) % total) === pos;
  if (rh.debug) {
    functions.chatLog('[turn event ' + rh.turnSeq + '] isMyTurn=' + game.turn.isMyTurn +
      ' count=' + game.turn.count + ' seat=' + (pos + 1) + '/' + total + ' -> ' + (mine ? 'refill' : 'skip'));
  }
  if (mine) {
    await refillResolve();
  }
}

// Find a card by its runtime id in whichever section it is in now.
function findCardById(id) {
  for (const section of Object.keys(cards ?? {})) {
    for (const c of (cards[section] ?? [])) {
      if (c.id === id) return c;
    }
  }
  return null;
}

// Runs when cards leave your hand (played, or moved away by a card effect).
// If you cannot afford them and the resolve check is ON, they go back to your hand.
async function onCardsLeftHand(transitionCards) {
  const rh = game.data.ResolveHelper;
  if (!rh.started) return; // ignore the mulligan before the game begins
  const left = transitionCards ?? [];
  let total = 0;
  for (const card of left) {
    const data = functions.getCardData(card);
    total += Number(data?.cost) || 0;
  }
  if (total <= 0) return;
  const before = Number(rh.current) || 0;

  if (total <= before) {
    functions.chatLog('spends ' + total + ' resolve');
    await setResolve(before - total);
    return;
  }

  // Not enough resolve.
  if (rh.enforce) {
    const back = left.map(function (c) { return findCardById(c.id); }).filter(Boolean);
    if (back.length === left.length) {
      await functions.moveCards(back, 'Hand', { noLogs: true });
      functions.chatLog('cannot play that: needs ' + total + ' resolve but has ' + before + ' (returned to hand)');
      return;
    }
  }
  // Check is OFF, or the card could not be found: warn and spend what is left.
  functions.chatLog('did not have enough resolve (needed ' + total + ', had ' + before + ')');
  await setResolve(0);
}