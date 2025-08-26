// Глобальные тексты/настройки. Без модулей — вешаем на window.
window.TEXT = {
  hint: "A/D — бег • Space — прыжок (×2 — полёт) • X — удар мечом • R — рестарт",
  summaryTitle: "Конец раунда",
  summaryWon: "Ты дошёл до конца! 🎉",
  summaryEnded: "Раунд завершён.",
  killsLabel: "Побед",
  checkpointLabel: "Чекпоинт",
  again: "🔄 Играть снова",
};

window.CONFIG = {
  worldWidth: 10000,         // длина уровня ~ 2 минуты
  gravity: 0.7,
  airFriction: 0.98,
  groundFriction: 0.84,
  maxVx: 6.2,
  maxVy: 16,
  checkpointInterval: 2000,  // каждые ~2000 px
  maxEnemies: 10,
  enemySpawnMs: 1100,
  softFailTimeoutMs: 180000, // страховка окончания через 3 минуты
  spikeDensityDiv: 220,      // чем меньше, тем больше шипов
  chickenScale: 2,           // курица ×2
};
