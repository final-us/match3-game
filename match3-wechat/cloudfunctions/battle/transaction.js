'use strict';

// Restore the conflict code dropped by wx-server-sdk's document error wrapper.
// The database SDK remains responsible for bounded retries and fresh snapshots.
module.exports = function runTransaction(db, callback) {
    return db.runTransaction(async function (transaction) {
        try {
            return await callback(transaction);
        } catch (error) {
            if (error && error.errCode === -501001 && typeof error.errMsg === 'string' &&
                error.errMsg.includes('[ResourceUnavailable.TransactionConflict]')) {
                error.code = 'DATABASE_TRANSACTION_CONFLICT';
            }
            throw error;
        }
    });
};
