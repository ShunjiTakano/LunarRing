// Lunar Ring custom scripting functions.
// Referenced via gamefile.json's top-level "scriptsUrls".
//
// Pattern (idempotent init guarded by a flag, fired on multiple events for
// reliability) is copied directly from the TCG-Arena-MTG reference's
// iniRoles()/tryCreateRoleCard() functions, which are confirmed working in
// a live, published game.

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

  chatLog("Vitals set from " + thriving.name + " (Thriving): " + thriving.health + " HP, " + thriving.cost + " Resolve.");
}
