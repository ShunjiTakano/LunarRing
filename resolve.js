// Lunar Ring - automatic resolve refill.
// Resolve maximum is read from the "cost" field of your current Devotee card
// (Thriving 3 / Wounded 5 / Desperate 10 etc. in cards.json).
// Assumes Counter 2 (index 1) is Resolve, as in your gameplay.defaultNotes.

async function refillResolve() {
  // The current condition is the best (earliest) one still on the board:
  // worsened conditions are discarded, so Thriving > Wounded > Desperate.
  const rank = { Thriving: 0, Wounded: 1, Desperate: 2 };
  let current = null;
  for (const card of (cards.Devotee ?? [])) {
    const data = functions.getCardData(card);
    const r = rank[data?.condition];
    if (r === undefined) continue;
    if (current === null || r < current.rank) current = { rank: r, data: data };
  }
  if (current === null) return;

  const max = Math.max(0, Math.min(10, Number(current.data.cost) || 0));
  game.data.ResolveHelper.max = max;
  await functions.changeCounterValue(1, max);
  functions.chatLog('restores resolve to ' + max);
}

// Runs on every new turn for every player, so only act on your own turn.
async function onMyNewTurn() {
  if (game.turn.isMyTurn) {
    await refillResolve();
  }
}
