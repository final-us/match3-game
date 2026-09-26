'use strict';
// Actual cloud handler, isolated cloned transactions, no SDK/network/account access.
const fs = require('fs');
const vm = require('vm');
const { createRequire } = require('module');
const { createRetentionDb } = require('./retention-db');

function createBattleLocal(now = Date.now) {
    const storage = createRetentionDb(['battle_rooms', 'daily_runs', 'daily_progress',
        'retention_profiles', 'retention_events', 'retention_receipts', 'retention_battle_evidence']);
    let identity = '';
    const file = require.resolve('../../cloudfunctions/battle/index');
    const localRequire = createRequire(file);
    const cloud = { init() {}, DYNAMIC_CURRENT_ENV: 'offline', database: () => storage.db,
        getWXContext: () => ({ OPENID: identity }) };
    class Clock extends Date { static now() { return now(); } }
    const mod = { exports: {} };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
        exports: mod.exports, module: mod, Date: Clock, console, process: { env: {} },
        require: name => name === 'wx-server-sdk' ? cloud : localRequire(name)
    }, { filename: file });
    return { storage, call(openid, event) { identity = openid; return mod.exports.main(event); } };
}
module.exports = { createBattleLocal };
