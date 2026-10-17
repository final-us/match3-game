/** Deterministic single-player content; daily and PvP retain their frozen sources. */
const curated = require('./curated-levels');
const templates = require('./level-templates');
const VERSION = 'infinite-v8';
const BASE = [76,72,68,60,78,64,70,58,50,42];
const PEAK = [48,44,38,30,58,36,42,28,26,22];
const INTRO = [95,95,95,95,90,90,90,85,85,85];
function normalize(id) {
    const n = Number(id);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
}
function targetFor(id) {
    if (id <= 10) return INTRO[id - 1];
    const c = Math.floor((id - 11) / 10), slot = (id - 11) % 10;
    return Math.round(BASE[slot] + (PEAK[slot] - BASE[slot]) * Math.min(1, c / 8));
}
function getLevel(value) {
    const id = normalize(value);
    if (!id) return null;
    const level = id <= 10 ? curated.getCuratedLevel(id, { targetFor }) : templates.makeLevel(id);
    level.targetWinRate = targetFor(id);
    level.trackingPaw = id >= 3;
    level.colorBell = id >= 4;
    level.contentRevision += '-specials-v3';
    if ((level.moonbuds || []).length || level.yarn) level.contentRevision += '-obstacles-v2';
    return level;
}
module.exports = {
    generatorVersion: 'curated-v8 + infinite-v8 + moves-v1',
    legacyGeneratorVersion: 'infinite-v5',
    infiniteGeneratorVersion: VERSION,
    curatedGeneratorVersion: curated.GENERATOR_VERSION,
    getLevel,
    getTargetWinRate(value) { const id = normalize(value); return id ? targetFor(id) : null; }
};
