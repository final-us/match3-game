'use strict';

const assert = require('assert');

function copy(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

function createRetentionDb(collectionNames) {
    const names = collectionNames || [
        'retention_profiles', 'retention_events', 'retention_receipts',
        'retention_battle_evidence', 'daily_runs'
    ];
    const docs = Object.fromEntries(names.map(function (name) { return [name, Object.create(null)]; }));
    let tail = Promise.resolve(); let nextReadError = null;

    function matches(value, condition) {
        return Object.keys(condition).every(function (key) {
            const expected = condition[key];
            if (expected && Object.prototype.hasOwnProperty.call(expected, 'lt')) return value[key] < expected.lt;
            return value[key] === expected;
        });
    }

    function ref(store, name, id) {
        return {
            get: async function () {
                if (nextReadError) { const error = nextReadError; nextReadError = null; throw error; }
                return { data: copy(store[name][id]) || null };
            },
            set: async function (options) {
                assert(options && options.data && typeof options.data === 'object');
                assert.strictEqual(Object.prototype.hasOwnProperty.call(options.data, '_id'), false,
                    'cloud database set data must not include SDK-managed _id');
                assert.strictEqual(Object.prototype.hasOwnProperty.call(options.data, '_openid'), false,
                    'cloud database set data must not include SDK-managed _openid');
                store[name][id] = Object.assign({ _id: id }, copy(options.data));
                return {};
            },
            update: async function (options) {
                if (!store[name][id]) throw new Error('DATABASE_DOCUMENT_NOT_EXIST');
                Object.assign(store[name][id], copy(options.data)); return {};
            }
        };
    }

    function query(store, name, condition) {
        let order = null; let maximum = Infinity;
        const api = {
            orderBy: function (key, direction) { order = { key: key, direction: direction }; return api; },
            limit: function (value) { maximum = value; return api; },
            get: async function () {
                let values = Object.values(store[name]).filter(function (value) { return matches(value, condition); });
                if (order) values.sort(function (left, right) {
                    const result = (left[order.key] || 0) - (right[order.key] || 0);
                    return order.direction === 'desc' ? -result : result;
                });
                return { data: copy(values.slice(0, maximum)) };
            },
            remove: async function () {
                let removed = 0;
                Object.keys(store[name]).forEach(function (id) {
                    if (matches(store[name][id], condition)) { delete store[name][id]; removed++; }
                });
                return { stats: { removed: removed } };
            }
        };
        return api;
    }

    function collection(store, name) {
        assert(store[name], 'unknown collection ' + name);
        return {
            doc: function (id) { return ref(store, name, id); },
            where: function (condition) { return query(store, name, condition); }
        };
    }

    const db = {
        command: { lt: function (value) { return { lt: value }; } },
        collection: function (name) { return collection(docs, name); },
        runTransaction: function (handler) {
            const pending = tail.then(async function () {
                const staged = copy(docs);
                const result = await handler({ collection: function (name) { return collection(staged, name); } });
                names.forEach(function (name) { docs[name] = staged[name]; });
                return result;
            });
            tail = pending.catch(function () {});
            return pending;
        }
    };

    return {
        db: db,
        docs: docs,
        copy: copy,
        failNextRead: function (error) { nextReadError = error || new Error('temporary database failure'); }
    };
}

module.exports = { createRetentionDb: createRetentionDb, copy: copy };
