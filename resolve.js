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

// Current Devotee condition = the best (earliest) one still on the board:
// worsened conditions are discarded, so Thriving > Wounded > Desperate.
function getResolveMax() {
  const rank = { Thriving: 0, Wounded: 1, Desperate: 2 };
  let current = null;
  for (const card of (cards.Devotee ?? [])) {
    const data = functions.getCardData(card);
    const r = rank[data?.condition];
    if (r === undefined) continue;
    if (current === null || r < current.rank) current = { rank: r, data: data };
  }
  if (current === null) return null;
  return Math.max(0, Math.min(10, Number(current.data.cost) || 0));
}

async function refillResolve() {
  const max = getResolveMax();
  if (max === null) return;
  game.data.ResolveHelper.max = max;
  await setResolve(max);
  functions.chatLog('restores resolve to ' + max);
}

// Runs on every new turn for every player, so only act on your own turn.
async function onMyNewTurn() {
  if (game.turn.isMyTurn) {
    await refillResolve();
  }
}

// Runs when cards leave your hand (played, or moved away by a card effect).
async function onCardsLeftHand(transitionCards) {
  const rh = game.data.ResolveHelper;
  if (!rh.started) return; // ignore the mulligan before the game begins
  let total = 0;
  for (const card of (transitionCards ?? [])) {
    const data = functions.getCardData(card);
    total += Number(data?.cost) || 0;
  }
  if (total <= 0) return;
  const before = Number(rh.current) || 0;
  if (total > before) {
    functions.chatLog('did not have enough resolve (needed ' + total + ', had ' + before + ')');
  } else {
    functions.chatLog('spends ' + total + ' resolve');
  }
  await setResolve(before - total);
}