# PvP four-item cloud contract (local implementation)

The existing room protocol remains `protocolVersion: 2`. A room created with
`{protocolVersion:2,itemRulesVersion:3}` uses the four-item rules for every round.
Rooms without `itemRulesVersion:3` retain the two-item, three-use rules. A v3
client may join an old room and must then use its returned legacy rules. A client
without `itemRulesVersion:3` cannot join a v3 room (`UPDATE_REQUIRED`).

For v3 rooms, `ready`, `configureItems`, `syncScore`, `useItem`, `leave`, and
`rematch` send the current `roundId`, `protocolVersion:2`, and
`itemRulesVersion:3`. A mismatch in the round returns `STALE_ROUND`; a missing
or mismatched item rules version returns `UPDATE_REQUIRED`. `query` sends the
same identity. A stale `query` is read-only and returns the current round state
for reconciliation. All successful v3 responses carry `itemRulesVersion:3`.

Room transactions retain the database SDK's bounded conflict retry (three
retries, four attempts total). The installed wx-server-sdk wraps document
read/update conflicts and loses the database `code`; only wrapped errors with
`errCode:-501001` and the exact `[ResourceUnavailable.TransactionConflict]`
marker regain `code:"DATABASE_TRANSACTION_CONFLICT"` inside the transaction
callback. Each retry reads a fresh room snapshot and rechecks the request;
committed cast IDs remain idempotent. Other errors are not retried. Exhausted
retries retain the original diagnostic and return the existing `服务异常` failure.
The same small transaction executor also normalizes the seven retention/catalog
profile transaction paths; their existing reward and request deduplication rules
remain in the callback. Other transaction entry points are unchanged.

## Loadout and effects

The default loadout is `{freeze:2,disturb:1,reflect:1,cheer:1}`. Every v3
`configureItems` request supplies all four nonnegative integer keys with a
total from zero through five. `ready:true` requires exactly five. A player may
edit after `ready:false`; server readiness locks the loadout. Each use consumes
one selected item and starts that item's independent ten-second cooldown. Other
items remain usable during its cooldown and active effect. Using any item while
frozen is still rejected. Cooldowns use server receipt time; at exactly the
selected item's deadline it becomes usable again.

Players store `itemCooldowns` keyed only by their room's allowed item types.
`query.myItemCooldowns` and successful `useItem.itemCooldowns` expose those
absolute deadlines, including idempotent cast replies. New players and rounds
start with zero deadlines. The old `itemCooldownUntil` / `activeEffectUntil`
fields remain for older clients, which may retain their shared lock. A player
saved without a map keeps the old shared cooldown/effect lock until a successful
cast migrates it; query projects that lock onto all allowed keys without writing
the room. A new client connected to an older cloud response without the map also
keeps the shared lock. A rejected or repeated request cannot extend a cooldown
or spend another item. The client shows ceiling seconds on each cooling icon,
compares against server-adjusted time, and removes the label at expiry. Exhausted
items show their exhausted state instead of an unusable countdown.

`useItem` requires a unique 12–64 character ASCII `requestId` (letters,
digits, `_`, `-`). Repeating the same ID and item in the same round returns the
existing cast without spending a second item; reusing the ID for another item
returns `道具请求冲突`. Keep the same ID and item when retrying an uncertain call; rebuild its samples from the current unacknowledged queue after reconciliation. An already committed cast is returned before sample validation. The
server assigns unpredictable effect IDs. Freeze lasts three seconds, disturb
five seconds, reflect five seconds, cheer five seconds. Reflect blocks and
returns the first freeze or disturb that reaches it. The returned effect can
be blocked by another shield, but never reflects a second time. A consumed
shield ends immediately. Attacks and shields use server receipt time; a late
poll never extends an effect.

`query.effects` contains events targeted to this player. For freeze/disturb,
`status:"active"` means apply the effect and `status:"blocked"` means show
only blocked feedback. Returned attacks include `reflected:true` and
`sourceEffectId`. The player's reflect and cheer grants also appear in
`effects`; a reflect event changes from `active` to `triggered` on use.
`query.casts` contains only that player's casts, including `requestId`,
`status` (`active` or `reflected`), and `reflectedEffectId` when applicable.
`useItem` returns the cast and initial effect immediately. All returned event
objects omit OpenIDs; the cloud function routes them privately.

## V3 score samples

The client emits one cumulative **raw** score sample for each resolved match:
`{seq,score,at}`. `seq` starts at 1 and increments by one; `score` is the raw
score before cheer multiplication; `at` is an integer millisecond completion
time. The client floors the newly sampled server-adjusted time before applying
the monotonic timestamp guard. Clock offsets themselves may contain half a
millisecond: they derive from `query.serverTime` and the request/response midpoint
of the lowest-RTT sample in the round. Odd-millisecond round trips must not send
fractional timestamps. This limits later slow-response drift; asymmetric transit
time remains an estimation error. The client sends ordered
samples in `syncScore({samples:[...]})`; one request accepts at most 32.
`useItem` may carry pending `samples` and accepts them atomically **before**
granting the item. The client must flush its pending matches in the cheer cast
request. This prevents its earlier local backlog from receiving the new cheer
window. An empty array is valid for `useItem`. V3 ordinary `syncScore` requires at least
one sample and does not use the legacy `score` field. Only `final:true` permits
an empty `samples` array; a supplied `final` must be a boolean.

The server stores the last accepted sequence, raw score and timestamp, and
derives the displayed score from raw increments. An increment is doubled only
when its accepted sample timestamp falls inside a server-issued cheer window
`[at,until)`. Each request checks contiguous sequence, increasing raw score,
the existing per-increment and elapsed-time score ceilings at both sample and
receipt time, round bounds, monotonic timestamps, and a future allowance of at
most 1.5 seconds. Samples must complete strictly before `endTime = startTime + 60000`. The server
accepts these samples until `scoreCloseAt = endTime + 10000`, while the room is
still playing and the player has not finalized. Samples completed at or after
`endTime`, or requests received at or after `scoreCloseAt`, remain rejected.
The client bypasses its 300ms batching throttle in the last 800ms. A client
performs post-input score synchronization only when the server advertises
`scoreCloseAt`; an old server without that field retains the original behavior. Freeze blocks new input; an
already-started cascade can still finish and report score. Client timestamps
and raw score retain the game's existing plausibility-checked client trust;
they are not proof of board simulation.

`syncScore` and `useItem` return `ackSeq`, `rawScore`, `myScore`, `serverTime`,
`myFrozenUntil`, `myReflectUntil`, `myCheerUntil`, `scoreCloseAt`, and
`myScoreFinalized` (a boolean for this player only). The latest
identical sample can be retried without another increment. Older or changed
sequence values return `STALE_SCORE_SAMPLE`; after an uncertain response,
reconcile against `query.myScoreSeq`, `query.myRawScore`, and `query.myScore`
before sending subsequent queued samples. A failed `useItem` does not accept
its samples. `query` also returns `serverTime`, `myItems`,
`myItemCooldowns`, `myItemCooldownUntil`, `myActiveEffectUntil`, `myFrozenUntil`,
`myReflectUntil`, `myCheerUntil`, `scoreCloseAt`, and `myScoreFinalized`.
`scoreCloseAt` is zero before a start time is assigned. Compare these absolute
timestamps to server-adjusted time. A new round or replacement opponent resets
samples, score, confirmation, cooldown and effects.

The legacy two-item room retains `syncScore({score})`, its loadout and effect
rules; the new server also returns the independent cooldown map for its two
allowed items. Clients should branch on the returned room rule version.

## End-of-input confirmation

Input and new item grants stop at `endTime`; the ten-second score confirmation
window does not extend gameplay, item duration, loadout budget, or cooldowns.
During `[endTime,scoreCloseAt)`, `syncScore({samples:[...],final:true})` may
atomically accept the last batch and mark this player's score finalized. Earlier
confirmation is rejected without accepting any samples. Ordinary batches remain
nonempty and may flush a queue before the final batch. Every existing timestamp,
sequence, raw score increment/rate, and cheer-window check still applies. A
failed request accepts no partial score or confirmation.

Once finalized, no new sequence is accepted (`SCORE_FINALIZED`). The latest
identical sample or an empty `final:true` can be retried idempotently within the
confirmation window, including after both players' confirmation settled the
room; a retry never reopens the room or grants another win/reward.

V3 time and heartbeat checks do not finish a room during the confirmation
window. Both players' confirmations settle immediately; at `scoreCloseAt` the
next query forcibly settles using accepted scores. A client that never sends
`final:true` therefore adds at most ten seconds to the original time deadline.
Before `endTime`, the existing offline and leave outcomes remain unchanged.
After `endTime`, leaving only marks the player offline/left and does not
forfeit or shorten the score window; the eventual time result is not retention
quit evidence. Already finished rooms remain finished. Settlement, cumulative
wins, retention evidence, and the three-second query heartbeat write gate retain
their existing idempotence. Legacy two-item rooms retain the original sixty-
second score and settlement cutoff. No new protocol or status value is used.

Room updates write the entire `result` map with the database's explicit set
command. This is required when rematching, replacing an opponent, or leaving
a waiting room: the installed SDK omits a plain nested empty object from an
update. Final settlement also replaces the whole map so obsolete opponent keys
cannot survive a nested merge. Existing finished-room result compatibility is
unchanged; this does not migrate historical results, wins, rewards, or retention
evidence.
