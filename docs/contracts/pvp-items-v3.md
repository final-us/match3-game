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

## Loadout and effects

The default loadout is `{freeze:2,disturb:1,reflect:1,cheer:1}`. Every v3
`configureItems` request supplies all four nonnegative integer keys with a
total from zero through five. `ready:true` requires exactly five. A player may
edit after `ready:false`; server readiness locks the loadout. Each use consumes
one selected item and starts a shared ten-second cooldown. Using an item while
frozen or while the player's own active item effect remains is rejected.

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
score before cheer multiplication; `at` is the match completion time on the
server-adjusted clock, derived from `query.serverTime` and the request/response midpoint of the lowest-RTT sample in the round. This limits later slow-response drift; asymmetric transit time remains an estimation error. The client sends ordered
samples in `syncScore({samples:[...]})`; one request accepts at most 32.
`useItem` may carry pending `samples` and accepts them atomically **before**
granting the item. The client must flush its pending matches in the cheer cast
request. This prevents its earlier local backlog from receiving the new cheer
window. An empty array is valid for `useItem`. V3 `syncScore` requires at least
one sample and does not use the legacy `score` field.

The server stores the last accepted sequence, raw score and timestamp, and
derives the displayed score from raw increments. An increment is doubled only
when its accepted sample timestamp falls inside a server-issued cheer window
`[at,until)`. Each request checks contiguous sequence, increasing raw score,
the existing per-increment and elapsed-time score ceilings at both sample and
receipt time, round bounds, monotonic timestamps, and a future allowance of at
most 1.5 seconds. Old samples remain valid until the round closes so a weak
network can recover a contiguous queue within the round. The client bypasses its
300ms batching throttle in the last 800ms; samples arriving after round close
remain rejected, so delayed final points are not guaranteed. Freeze blocks new input; an
already-started cascade can still finish and report score. Client timestamps
and raw score retain the game's existing plausibility-checked client trust;
they are not proof of board simulation.

`syncScore` and `useItem` return `ackSeq`, `rawScore`, `myScore`, `serverTime`,
`myFrozenUntil`, `myReflectUntil`, and `myCheerUntil`. The latest
identical sample can be retried without another increment. Older or changed
sequence values return `STALE_SCORE_SAMPLE`; after an uncertain response,
reconcile against `query.myScoreSeq`, `query.myRawScore`, and `query.myScore`
before sending subsequent queued samples. A failed `useItem` does not accept
its samples. `query` also returns `serverTime`, `myItems`,
`myItemCooldownUntil`, `myActiveEffectUntil`, `myFrozenUntil`,
`myReflectUntil`, and `myCheerUntil`. Compare these absolute timestamps to
server-adjusted time. A new round resets samples, score, cooldown and effects.

The legacy two-item room retains its original `syncScore({score})` and item
responses; clients should branch on the returned room rule version.
