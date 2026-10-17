'use strict';

const config = require('./config');
const gridUtil = require('./grid');
const trackingPaw = require('./tracking-paw');

function key(position) {
    return position.row + ':' + position.column;
}

function footprint(core, type, origin) {
    const positions = [];
    for (let row = 0; row < core.grid.length; row++) {
        for (let column = 0; column < core.grid[row].length; column++) {
            if ((type === config.SPECIAL_TYPES.H_ROCKET && row === origin.row) ||
                (type === config.SPECIAL_TYPES.V_ROCKET && column === origin.column) ||
                (type === config.SPECIAL_TYPES.BOMB && Math.abs(row - origin.row) <= 1 && Math.abs(column - origin.column) <= 1)) {
                positions.push({ row: row, column: column });
            }
        }
    }
    return positions;
}

function snapshot(core, position) {
    return {
        target: { row: position.row, column: position.column },
        targetJelly: core.jellyGrid[position.row][position.column],
        targetIce: core.iceGrid[position.row][position.column],
        targetYarnHealth: core.isYarnRoot(position) ? core.getYarnHealth() : 0,
        targetYarnVine: core.isYarnVine(position)
    };
}

function plan(core, combo, excluded, yarnHit) {
    const types = config.SPECIAL_TYPES;
    const sources = [combo.first, combo.second];
    const bell = sources.find(source => source.type === types.COLOR_BELL);
    const paw = sources.find(source => source.type === types.TRACKING_PAW);
    if (!bell && !paw) return null;
    const targets = sources.map(source => ({ row: source.pos.row, column: source.pos.column }));
    const effects = {};
    const blockedTargets = (excluded || []).concat(targets);
    let kind;

    if (bell) {
        const other = sources.find(source => source !== bell);
        if (other.type === types.COLOR_BELL) {
            const landing = combo.second;
            kind = 'bellBell';
            effects[key(combo.first.pos)] = { skipDye: true };
            effects[key(landing.pos)] = { dyeRadius: 1,
                color: core.getSpecialBaseType(landing.pos) || core.getMostFrequentCommonType() };
        } else {
            kind = other.type === types.TRACKING_PAW ? 'bellPaw' : core.isRocket(other.type) ? 'bellRocket' : 'bellBomb';
            const color = core.getSpecialBaseType(bell.pos) || core.getMostFrequentCommonType();
            const occupied = blockedTargets.concat(footprint(core, other.type, other.pos));
            if (other.type === types.TRACKING_PAW) occupied.push(...core.yarnNeighbors(other.pos));
            const candidates = [];
            for (let row = 0; row < core.grid.length; row++) {
                for (let column = 0; column < core.grid[row].length; column++) {
                    const position = { row: row, column: column };
                    if (core.grid[row][column] !== color || core.isBlocked(position) ||
                        gridUtil.includesPosition(occupied, position)) continue;
                    candidates.push(position);
                }
            }
            candidates.sort((first, second) =>
                (Math.abs(second.row - bell.pos.row) + Math.abs(second.column - bell.pos.column)) -
                (Math.abs(first.row - bell.pos.row) + Math.abs(first.column - bell.pos.column)) ||
                first.row - second.row || first.column - second.column);
            const replicas = candidates.slice(0, 2).map(position => {
                core.grid[position.row][position.column] = other.type;
                core.setSpecialBaseType(position, color);
                targets.push(position);
                effects[key(position)] = { after: { row: bell.pos.row, column: bell.pos.column, phase: 'cast' } };
                return { row: position.row, column: position.column, previousType: color, type: other.type };
            });
            effects[key(bell.pos)] = { replicas: replicas, color: color };
        }
    } else {
        const other = sources.find(source => source !== paw);
        const local = sources.filter(source => source.type === types.TRACKING_PAW)
            .flatMap(source => [source.pos].concat(core.yarnNeighbors(source.pos)));
        const occupied = blockedTargets.concat(local);
        if (other.type === types.TRACKING_PAW) {
            kind = 'pawPaw';
            sources.forEach(source => { effects[key(source.pos)] = { pawTargets: [] }; });
            for (let index = 0; index < 3; index++) {
                const source = sources[index % 2];
                const destination = trackingPaw.target(core, source.pos, occupied, yarnHit);
                if (!destination) break;
                occupied.push(destination);
                effects[key(source.pos)].pawTargets.push(snapshot(core, destination));
            }
        } else {
            kind = core.isRocket(other.type) ? 'pawRocket' : 'pawBomb';
            const destination = trackingPaw.target(core, paw.pos, occupied, yarnHit);
            effects[key(paw.pos)] = { pawTargets: destination ? [snapshot(core, destination)] : [] };
            if (destination) {
                effects[key(paw.pos)].carriedType = other.type;
                effects[key(other.pos)] = { effectOrigin: destination,
                    after: { row: paw.pos.row, column: paw.pos.column, phase: 'impact' } };
            }
        }
    }
    return { targets: targets, suppressed: [], effects: effects, kind: kind };
}

module.exports = { plan, footprint, snapshot };
