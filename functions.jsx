// Lunar Ring custom scripting functions.
// Referenced via gamefile.json's top-level "scriptsUrls".
//
// Note: chatLog() is NOT available inside section "events" context (confirmed
// via live testing -- it throws "chatLog is not defined"). It only works
// inside blueprint onClick/onChange handlers. So this version signals success
// via game.data itself (visible directly on the board) instead of logging.

async function initVitals() {
  // Already ran once this game -- don't clobber manual adjustments made
  // mid-game (e.g. after taking damage).
  if (game.data.Vitals.initialized) return;

  // The Devotee section holds all 3 condition cards (Thriving/Wounded/
  // Desperate) for this player, placed there at game start via
  // categoriesAlreadyOnBoard. Find the Thriving one.
  const thriving = cards?.Devotee?.find(c => c.condition === "Thriving");
  if (!thriving) return; // Devotee section not populated yet -- try again next event.

  game.data.Vitals.health = thriving.health;
  game.data.Vitals.resolve = thriving.cost;
  game.data.Vitals.initialized = true;
}