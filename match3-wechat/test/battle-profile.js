'use strict';
const assert = require('assert');
const { createBattleLocal } = require('./helpers/battle-local');
const avatar = 'https://thirdwx.qlogo.cn/avatar/132';
const guestAvatar = 'https://qlogo.cn/guest';
const unsafe = ['http://qlogo.cn/a', 'https://evil.com/a', 'https://qlogo.cn.evil/a',
    'https://evilqlogo.cn/a', 'https://user@qlogo.cn/a', 'https://qlogo.cn/a#frag',
    'https://qlogo.cn:443/a', 'https://qlogo.cn\\evil/a', 'https://qlogo.cn/a\n',
    'https://-x.qlogo.cn/a', 'https://qlogo.cn/' + 'x'.repeat(768), null];
(async () => {
    const local = createBattleLocal(() => 1800000000000);
    const v = { protocolVersion: 2, itemRulesVersion: 3 };
    for (const url of unsafe) {
        assert.strictEqual((await local.call('invalid', { ...v, action: 'create', avatarUrl: url })).err, 'INVALID_AVATAR_URL');
    }
    const created = await local.call('host', { ...v, action: 'create', avatarUrl: avatar });
    assert(created.ok);
    const roomId = created.roomId;
    const event = action => ({ ...v, action, roomId, roundId: local.storage.docs.battle_rooms[roomId].roundId });
    assert((await local.call('guest', { ...event('join'), avatarUrl: guestAvatar })).ok);
    const room = () => local.storage.docs.battle_rooms[roomId];
    assert.strictEqual(room().players[0].avatarUrl, avatar);
    const snapshot = () => JSON.stringify(room());
    let before = snapshot();
    assert.strictEqual((await local.call('stranger', { ...event('profile'), avatarUrl: avatar })).ok, false);
    assert.strictEqual((await local.call('stranger', event('query'))).ok, false);
    assert.strictEqual(snapshot(), before);
    for (const url of unsafe) {
        assert.strictEqual((await local.call('guest', { ...event('profile'), avatarUrl: url })).err, 'INVALID_AVATAR_URL');
        assert.strictEqual((await local.call('guest', { ...event('join'), avatarUrl: url })).err, 'INVALID_AVATAR_URL');
        assert.strictEqual(snapshot(), before);
    }
    assert((await local.call('guest', event('join'))).ok);
    assert.strictEqual(room().players[1].avatarUrl, guestAvatar, 'old join does not erase profile');
    before = snapshot();
    assert((await local.call('guest', event('profile'))).ok);
    assert.strictEqual(snapshot(), before, 'missing optional field changes nothing');
    assert.strictEqual((await local.call('guest', { ...event('profile'), roundId: 0, avatarUrl: avatar })).err, 'STALE_ROUND');
    assert.strictEqual((await local.call('guest', { ...event('profile'), itemRulesVersion: 0, avatarUrl: avatar })).err, 'UPDATE_REQUIRED');
    assert.strictEqual(snapshot(), before);
    room().players[0].ready = true; room().players[0].score = 42; room().players[0].rematchAccepted = true;
    const expected = JSON.parse(snapshot()); expected.players[1].avatarUrl = avatar;
    assert((await local.call('guest', { ...event('profile'), avatarUrl: avatar, ready: true, score: 999, openid: 'host' })).ok);
    assert.deepStrictEqual(JSON.parse(snapshot()), expected, 'only caller URL changes');
    const response = await local.call('host', event('query'));
    assert.strictEqual(response.opp.avatarUrl, avatar);
    assert(!JSON.stringify(response).includes('openid'));
    assert.strictEqual(response.avatarUrl, undefined);
    assert.strictEqual(room().players[1].avatarUrl, avatar);
    room().status = 'playing';
    before = JSON.parse(snapshot()); before.players[1].avatarUrl = guestAvatar;
    assert((await local.call('guest', { ...event('profile'), avatarUrl: guestAvatar })).ok);
    assert.deepStrictEqual(JSON.parse(snapshot()), before, 'midgame avatar update preserves all gameplay fields');
    room().status = 'finished'; room().finishedAt = 1800000000000;
    room().players[0].rematchAccepted = false;
    assert((await local.call('host', { ...event('rematch'), accept: true })).ok);
    const pending = snapshot();
    assert((await local.call('guest', { ...event('profile'), avatarUrl: avatar })).ok);
    const onlyAvatar = JSON.parse(pending); onlyAvatar.players[1].avatarUrl = avatar;
    assert.deepStrictEqual(JSON.parse(snapshot()), onlyAvatar, 'profile does not cancel rematch acceptance');
    assert((await local.call('guest', { ...event('rematch'), accept: true })).ok);
    assert.strictEqual(room().status, 'waiting');
    assert.strictEqual(room().players[0].avatarUrl, avatar);
    assert.strictEqual(room().players[1].avatarUrl, avatar);
    assert((await local.call('guest', { ...event('profile'), avatarUrl: '' })).ok);
    assert.strictEqual((await local.call('host', event('query'))).opp.avatarUrl, '');
    const legacy = await local.call('legacy', { action: 'create' });
    assert(legacy.ok);
    assert.strictEqual(local.storage.docs.battle_rooms[legacy.roomId].players[0].avatarUrl, undefined);
    console.log('battle profile isolated transaction tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
