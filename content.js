// Тексты/настройки
window.TEXT = {
  hint:
  // Игрок 1
  "ИГРОК 1: A/D — бег • W — прыжок (×2 — полёт) • S — присесть • Z/X/C/V — выбрать слот (меч/огонь/рука/рывок) • E — использовать | " +
  // Игрок 2
  "ИГРОК 2: ←/→ — бег • ↑ — прыжок • ↓ — присесть • N/M/,/. — выбрать слот (булава/вода/рука/рывок) • / — использовать • R — рестарт уровня",
  summaryTitle: "Конец раунда",
  summaryWon: "Вы дошли до конца! 🎉",
  summaryEnded: "Раунд завершён.",
  killsLabel: "Побед",
  checkpointLabel: "Чекпоинт",
  again: "🔄 Играть снова",
};

window.CONFIG = {
  // Мир
  worldWidth: 10000, gravity: 0.7, airFriction: 0.98, groundFriction: 0.84, maxVx: 6.2, maxVy: 16,
  checkpointInterval: 2000, maxEnemies: 10, enemySpawnMs: 1100, softFailTimeoutMs: 180000,
  spikeDensityDiv: 220, chickenScale: 2,

  // Баланс способностей
  swordTimeMs: 180, maceTimeMs: 200,
  dashTimeMs: 160, dashSpeed: 13, dashInvulnMs: 180,
  shotSpeed: 9, shotLifeMs: 1800,

  // Размеры инвентаря
  hotbarPad: 10, hotbarSlot: 42, hotbarGap: 8,
};
