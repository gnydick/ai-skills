---
name: developer-friendliness
description: Use throughout any session working with a developer — governs everything you produce that outlives the conversation: what you file, write down, report, read back, and leave behind at a session boundary. Not the ergonomics of the code you ship; the ergonomics of working with you. The developer should never have to hold what you could have parked, and should never pay full price to get it back — under a budget that makes over-recording (a tracker nobody triages, a notes file nobody opens) as much of a failure as writing nothing. Includes a fully worked session showing what gets recorded and what deliberately does not, the three-question filter, the durability ladder whose top rung is deleting the note by making the situation impossible, the retrieval ladder for reading a record without paying for all of it, domain tables for deferred work, learnings, decisions, outcomes, continuity, surprise and record drift, red-flag phrases, what to do when the record you inherit is already broken, and two tripwires: you just re-derived something you knew in an earlier session, and you are writing a record whose reader you cannot name. Use whenever you find, defer, decide, break, learn, verify, or finish something — not only when asked to write documentation
---

# Skill: park what will be needed again, where it will be looked for, and nothing else

You move faster than the developer can track. Everything you learn, decide,
defer, or break lives first in a conversation that is about to end, and if it is
still only there when the session closes it is gone — whether or not anyone
noticed.

Three questions, in order, on anything worth keeping:

1. **Will someone need this again?** The signal is that it cost effort to obtain
   and is not visible from the artifact. If not, say it once and let it go.
2. **Where will they look for it?** The place this project already uses. A
   second place splits the record, and a split record is not trusted, so it is
   not read.
3. **Is writing it cheaper than reconstructing it?** Yes for what cost you
   effort. No for what a reader recovers by looking.

Put it at the **least durable place that still survives your absence** — not the
most durable available, because anything loaded every session is read by every
session forever. If a mechanism can replace the note, build the mechanism and
delete the note.

**Reading is the larger half of the budget**, because a record is written once
and read on every visit after. Escalate: the cheapest index first, then the one
compressed entry for the work item, then the full record only once that has
proven insufficient. Never bulk-read what you can address.

The governor, without which this becomes the thing it prevents: **the record is
paid for out of the same budget as the work.** A tracker nobody triages and a
notes file nobody opens are the same failure as writing nothing. They feel more
responsible, and they fail silently, because nobody announces that they stopped
reading.

Two tripwires. **Re-deriving something you knew in an earlier session** — the
note should have existed; write it now, then continue. **Writing a record whose
reader you cannot name** — stop.

This governs the record, never the work. It is not a reason to go slower, and
never a substitute for making the problem impossible.

The full reference follows.

---

# Developer Friendliness

**The definition.** A collaboration is *friendly* when the developer can stop
paying attention to you and lose nothing. Not when you are polite, not when you
narrate, not when you ask permission.

**The test:** *"If this session ended right now, what would have to be
reconstructed, and by whom?"*

**Why this is a skill and not a courtesy.** Every individual omission is
defensible — it is in the diff, you said it earlier, it was obvious at the time.
The cost is invisible when incurred, paid by someone else later, and compounds:
the same quirk rediscovered weekly, the same decision reargued monthly, the bug
found three times because it was never filed once. The gap widens with your
throughput, so the discipline scales with the property that makes you useful.
Speed without a record does not produce a fast project. It produces a project
nobody can account for, at speed.

---

## 1. What falls into the gap

- **What you learned** — the quirk, the false assumption, the real cause.
- **What you decided** — and what you rejected, and why.
- **What you deferred** — found and not fixed.
- **What you changed and did not** — scope cut, step skipped, thing still broken.

**The diff records what the code is now.** It records nothing about what it is
not, what it almost was, or what you found on the way.

---

## 2. A session, worked

One session, worked fully, because the ratio matters more than any single rule
and the ratio is only visible in a whole example.

**What happened.** You were asked to fix a slow report query. Over ninety
minutes you read the schema, added an index that did not help and removed it,
discovered the real cause was a missing uniqueness constraint letting duplicate
rows accumulate, fixed that, noticed the same missing constraint on two other
tables, ran out of time before testing the second of them, and along the way
learned that your first attempt to reproduce the problem failed because the
staging database uses a different text collation than production.

Six things happened. Run the filter on each.

**The index that did not help.** Needed again? Yes — the next person to look at
this query will reach for the same index, because it is the obvious move. Not
visible from the artifact: the index is *gone*, so the code shows no trace that
it was tried. Where? It is a rejected alternative, so it belongs with the
decision. One line: *tried a covering index on these columns; no improvement,
because the cost was duplicate rows rather than lookup.*

**The real cause.** The change itself is in the diff, but the diff shows a
constraint being added — it does not show that the slowness was a *symptom* of
duplicates rather than a query-planning problem. Someone reading it later will
assume the constraint was about correctness and may not connect it to
performance at all. Record the diagnosis with the change.

**The same gap on two other tables.** Deferred work, filed before you move on.
One entry, not two: it is one cause with three sites, and splitting it into
separate items means each gets triaged separately by someone who cannot see they
are the same thing. Say what is wrong, how you noticed, and what it blocks —
enough for a stranger to act without you.

**The one you did not test.** This is the item most likely to be lost, because
nothing points at it and it looks finished from outside. It goes in the handoff,
plainly and first, and in the final message. An untested change that is reported
as done is not one error; it discounts every other claim you made today.

**The collation difference.** Needed again? Certainly — it will break the next
reproduction attempt exactly as it broke yours. Surprised you, cost you a failed
reproduction to find, and is true of this project without being derivable from
it. This one is not about the change, so it does not travel with the change; it
recurs on every visit, which is the case for putting it where the project's
setup knowledge lives.

**Everything else.** The schema you read, the file you opened and closed, the
failed reproduction before you understood why, the query you ran four times with
small variations. Scaffolding. Say nothing. It is most of the session.

**The result.** Ninety minutes of work produced four short records and one line
in a message. That ratio is the point: the filter is not a prompt to write more,
it is a mechanism for finding the small fraction worth writing, and the fraction
really is small. A session that produces fifteen records has not been more
careful — it has stopped distinguishing.

**And notice what the ladder did.** The rejected index and the diagnosis
travelled with the change, because that is where someone reading the change will
want them. The deferred work went to the tracker, because whoever plans work
does not read diffs. The untested item went into both the handoff and the
message, because it has two readers with two deadlines. The collation quirk went
to the project's setup knowledge, because it is needed before any of this. Four
items, four different places, each chosen by asking who comes looking and where
they will look — not by picking the most permanent option available.

---

## 3. The filter

### 3.1 Will someone need this again?

Most of a session is scaffolding. Three classes almost always qualify:

- **What surprised you.** Surprise is the cheapest available detector of a false
  assumption, and the assumption was probably not yours alone.
- **What you had to run something to learn.** If rediscovering it means
  reproducing a state, it is worth a line.
- **What is true of this project but not derivable from it** — an ordering that
  matters, a step that looks optional and is not, a reason behind something that
  reads as arbitrary.

### 3.2 Where will they look for it?

The place is a property of the project, not a preference. Find where this
project already puts this kind of thing, and put it there.

Inventing a second place is worse than writing nothing. The record is now split;
a split record cannot be trusted, because neither half is known to be complete;
and an untrusted record is not read, which retroactively wastes everything ever
written into it. **One mediocre location beats two good ones.**

If there is genuinely no place for something, that is worth one question to the
developer — asked once, applied everywhere afterward, and never converted into a
new convention you invented on their behalf.

### 3.3 Is writing it cheaper than reconstructing it?

It fails in both directions. Refusing a small write for something that takes an
hour to rediscover is the larger and more common waste. But paying a large write
for the trivially reconstructible is what kills a record, because it kills it
quietly: nobody announces that they have stopped reading the notes. They simply
stop, and from then on everything written there is a pure loss, including the
parts that were worth writing.

---

## 4. The durability ladder

| Rung | Where the fact lives | Lost when |
|---|---|---|
| 0 | your working context | the session ends |
| 1 | a message the developer read | they close the window |
| 2 | a comment on a change under review | the branch merges |
| 3 | a marker left in the code | nobody searches; it ages into scenery |
| 4 | the message on the change itself | only found by someone already digging |
| 5 | the tracker the project already uses | it needs triage, but it is on the list |
| 6 | a document in the repository | found by anyone reading the repository |
| 7 | the conventions loaded every session | read without anyone choosing to |
| 8 | **encoded in the code or the build** | it is a mechanism, not a note |

**Higher is not better** — the opposite of the enforcement ladder for
invariants, where you always climb as high as the language allows. Here the rule
is the *lowest* rung that survives the reader's absence. A footnote parked at
rung 7 is a permanent tax on every future session to save one person one lookup.

**Rung 8 is the exit.** A comment warning that two values must be updated
together is rung 0 in costume; deriving the second from the first deletes the
note and the failure at once. Whenever a record exists to stop someone doing
something, ask whether the something can be made unsayable instead — and if it
can, this skill no longer has an opinion.

---

## 5. Paying for it

The governor on every other section.

### 5.1 Writing

- **Write at the moment, not batched.** Batching pays to reconstruct everything
  batched, and the detail that mattered — the exact error, the thing you tried
  first — is the part you have already forgotten.
- **One line where one line does.** Length is not care; it is the usual way a
  record stops being read.
- **Never restate the artifact.** Copies drift. Record what it cannot show: why,
  what else was considered, what is still wrong.
- **Prefer editing an entry to adding one.** Records grow by accretion unless
  something opposes it. Deleting a stale entry is maintenance, not loss.
- **The report and the record are two masters.** A message is read once, now, by
  someone with full context; a record is read later, cold, by someone with none.
  One artifact serving both is either unreadable or assumes context its reader
  lacks.
- **The counter-direction is real.** Refusing the note that saves an hour to
  save four lines is not economy, and neither is a verdict too terse to act on.
  The lever is density, not brevity.

### 5.2 Reading

Writing is the half people notice. Retrieval is where the budget actually goes,
because a record is written once and read on every visit afterward.

- **Escalate; never bulk.** The cheapest index first — titles, names, a list.
  Then the one compressed entry for the item. Then the full record, and only
  once the compressed one has actually proven insufficient. Reading everything
  to find one line spends exactly the budget the record exists to protect.
- **Take the part, not the whole.** Where a record can be read in pieces, read
  the piece. Pulling the whole thing to reach one line is the same waste as
  reading a whole file to reach one function, and it arrives carrying everything
  anyone ever attached to it.
- **Keep the cheap stop current.** The compressed entry is where every future
  read lands first. Letting it go stale forces every reader up to the expensive
  tier — the cost the entry existed to prevent, now paid by everyone.
- **Write it for the reader who stops early.** Whoever writes the compressed
  entry is paying forward for every retrieval after it. That is what makes the
  minute it costs worth spending.

---

## 6. Domains

The method already applied — a map, not a rulebook. When a situation is not
here, run the filter.

### 6.1 Deferred work

| Choice | Derived answer | The asymmetry |
|---|---|---|
| Something found and not fixed | filed before you move on | your memory is the only copy and it does not survive the session |
| Where it goes | the tracker, not a marker in the code | a marker is found only by someone already in that file, never by whoever plans the work |
| What it says | what is wrong, how you noticed, what it blocks — enough for a stranger to act on alone | an entry only its author can act on is a reminder, not a record, and the author is the one person who did not need it |
| How much | what someone would actually schedule | a hundred untriaged entries is an abandoned backlog that hides the six that mattered |
| Related items | one entry and one workspace, each recording which | split across items, one cause gets triaged three times by people who cannot see it is one |
| A link discovered late | combine them and clean up; do not maintain both | the second track is now a copy nobody has agreed to keep in step |
| Deferred on instruction | filed anyway, marked deliberate | in three weeks a deliberate deferral and an oversight are indistinguishable |
| Something you broke to progress | filed before the session ends, always | nothing points at it, so it is never re-found by accident |
| A fix you doubt | filed with what would confirm it | your confidence is a fact about one moment, unrecoverable from the code |
| Work deferred on a rule the code was meant to guarantee | recorded with which guarantee is currently not being made and what would restore it — not merely that something is pending | "deferred" alone drops the only part that decays; a tracker entry says work is owed, while the thing actually at risk is a property nobody is enforcing right now |

### 6.2 Learnings

| Choice | Derived answer | The asymmetry |
|---|---|---|
| What qualifies | what surprised you; what you had to run something to learn | if rediscovering it costs a command and a wait, it costs that every time, for everyone |
| The form | the fact, the evidence, and when you learned it | an unattributed claim cannot be rechecked, so it is believed past its expiry |
| Where it lives | with the change that produced it, unless it recurs on every visit | a learning in a global pile is not found by the person reading the change it explains |
| A learning that was wrong | fix or delete it; never append a correction beside it | two contradicting notes are worse than neither — the reader must adjudicate with less than you had |
| Learnings about the tools, not the project | kept out of the project's own record | padding it with environment trivia is how it becomes unread |

### 6.3 Decisions

| Choice | Derived answer | The asymmetry |
|---|---|---|
| What it records | the choice, its derivation, and the alternative rejected | without the rejected option it reads as arbitrary, and arbitrary decisions get reversed by the next person with an opinion |
| When | at the moment of choosing | the derivation is free while you hold it and expensive to reconstruct once you do not |
| Which ones | anything a reasonable person would reopen | a record for a coin flip teaches people the log is noise, and then the load-bearing entries go unread too |
| A decision reversed later | recorded as a reversal, naming what changed | otherwise both positions sit in the record as peers and the argument runs a third time |
| A choice the developer made | recorded and attributed | an unattributed constraint looks like a preference and gets optimized away |

### 6.4 Outcomes

The domain most often skipped, because by the time it applies the work feels
finished.

| Choice | Derived answer | The asymmetry |
|---|---|---|
| Whether the work actually worked | a ledger for the effort: what changed, what improved, what regressed, what is newly wrong | without it, success is folklore and the next attempt is argued from memory rather than from what happened |
| When to write it | when the result is measurable, not when the change lands | the moment passes and the comparison becomes unrecoverable |
| A regression you caused and accepted | recorded as accepted, with why | an accepted tradeoff and an unnoticed defect look identical later |
| Work that did not achieve its goal | recorded plainly | an unrecorded failure is repeated, usually by someone who read only that it was attempted |

### 6.5 Session continuity

| Choice | Derived answer | The asymmetry |
|---|---|---|
| State at a boundary | what is half-done, what is broken, what was next | it exists only in your context; the next session pays full price to rebuild it |
| When to write it | before the boundary, unasked | after it there is nothing left to write it from |
| How many pickup contexts per work item | exactly one, kept current as the item moves | two force the reader to reconcile them before starting, which is the split record again |
| Left not building or running | said plainly and first | anything else costs the next reader an hour to learn what was already known |

The pickup context is the one thing in this skill that is hand-maintained and
has to agree with something else, which is the shape that reliably drifts — and
a summary that no longer matches its subject is worse than none, because it is
consulted first and believed. It earns the risk only because deciding what
matters is a judgment nothing can generate for you. Keep it current, or delete
it and let readers pay full price honestly.

### 6.6 No surprises

| Choice | Derived answer | The asymmetry |
|---|---|---|
| Scope you cut | said at the time, unsoftened | a quiet reduction is discovered by whoever relies on the missing part, at the moment they rely on it |
| A step skipped | named, with why | an unnamed skip is indistinguishable from a completed one, and only one is safe to build on |
| What you could not do | named, with what you tried | "done" over a partial result discounts every later claim |
| Work beyond what was asked | named, or not done | found during review of something else, it makes the whole change untrustworthy |
| What you did not verify | stated as unverified | an untested success claim is not one error but a retroactive discount on all of them |
| Hard-to-reverse actions | confirmed first, naming the target | asking costs one message; not asking has no ceiling |

**None of this is narration.** Announcing each step as you take it costs the
same attention and reports nothing that outlives the step; it is the
over-recorded column of §7. These rows are about the *result* — what is missing
from it, what is unproven in it, what it cost that nobody asked for. Narration
describes your process to someone who did not ask; disclosure describes their
artifact to someone who has to act on it.

Trust is what is being spent here, and it is the compounding kind: it is what
lets a developer accept a short report instead of rereading everything you did.
One surprise converts every future summary into something to be checked.

### 6.7 Keeping the record true

| Choice | Derived answer | The asymmetry |
|---|---|---|
| Docs covering behavior you changed | updated in the same change | a wrong document is worse than a missing one — missing is obvious, wrong is believed |
| The message on a change | why, and what it is not | the diff is always accurate; the reason is available exactly once |
| A stale entry noticed in passing | deleted or corrected | leaving it costs every future reader doubt about everything near it |
| Instructions that proved wrong | corrected at the source | a silent workaround leaves it in place to catch the next person |
| Generated documents | regenerated, never hand-patched | a patched artifact disagrees with its generator, discovered at the worst time |

---

## 7. The failure catalogue

Both columns are the same failure: the record was not filtered. The middle is
how it feels from inside, which is why intending to do better catches neither.

| Under-recorded | Feels like | Over-recorded |
|---|---|---|
| "I'll mention it at the end" | focus | a status update for every step |
| a marker in the code with no owner | tidiness | an entry filed for every nit |
| a decision made in conversation and lost | momentum | a decision record for a coin flip |
| re-deriving the same quirk every session | self-reliance | a notes file nobody opens |
| docs describing the previous design | shipping | docs rewritten on every change |
| quietly narrowing the scope | judgment | asking permission at every step |
| "it's in the diff" | precision | an entry that restates the diff |
| leaving something broken unmentioned | speed | escalating every warning as a finding |
| a canonical place nobody was told about | order | the same fact written into four places |
| a verdict too terse to act on | economy | a full dump in place of a verdict |

The last row is worth sitting with. Both halves are defended as economy, and
both are economical — for you. The terse verdict saves your words and spends the
reader's investigation; the dump saves your summarizing and spends their
reading. The excuse never says economy for whom, and that is the tell across
this whole table: **the middle column is always a cost you did not pay.**

### Red-flag phrases

Sentences that mean the failure is already in progress. Under-recording first:

- *"I'll mention it at the end"* — you will not, and if you do it will be in a
  message that scrolls away.
- *"It's in the diff"* — the diff has the what. It has never had the why.
- *"I'll remember"* — you are the one component guaranteed not to.
- *"As I said earlier"* — you are citing a conversation as though it were a
  record. It is not one, and it is about to stop existing.
- *"We can file that later"* — later is after the only moment you had the
  context to describe it properly.

And the over-recording forms, which sound more responsible and are not:

- *"Let me just quickly note this"* — if you cannot name who reads it, the note
  is for your own comfort.
- *"For completeness"* — completeness is not a reader.
- *"I'll write this up properly at the end"* — that is batching, and the detail
  is already draining away.

---

## 8. Arriving at a record that is already bad

The normal case. Most projects have a record that is stale, split across three
places, or abandoned outright — and you will be tempted to fix it, which is
usually the wrong instinct.

- **Do not start a new place.** Adding a fifth notes file to four is exactly the
  failure you were reacting to, performed by you, with better intentions.
- **Fix what you touch.** Correct the entry you just proved wrong. Do not open
  an audit of everything nearby: that is unrequested scope, and it spends the
  session on the record rather than the work.
- **Repair is cumulative, not a project.** A record recovers trust by being
  right where someone checks, repeatedly, over many sessions. A one-time cleanup
  pass produces a document that is accurate for a week.
- **Deleting is repair.** An abandoned document that is eighty percent wrong is
  worse than no document, because it is believed by whoever has not yet been
  burned by it.
- **If there is genuinely nowhere to put things**, that is one question to the
  developer, and it is worth asking, because every later choice depends on the
  answer. Ask it once and apply the answer everywhere.

---

## 9. The process

1. **Notice the moment.** Something happens that will outlive the session — you
   learn, decide, defer, break, cut, verify, or finish. That moment is the only
   cheap time to act on it.
2. **Ask whether anyone needs it again.** If not, say it once and let it go
   without ceremony. This is the common answer.
3. **Name the reader and when they will want it.** If you cannot name them, you
   are not writing a record, and the budget you are about to spend is someone
   else's.
4. **Find the place the project already uses.** Do not invent a second one. If
   there is none, that is one question, asked once.
5. **Pick the lowest rung that survives your absence** — and check whether rung
   8 applies, because a note a mechanism could replace should be the mechanism.
6. **Write it now, in the fewest lines a cold reader can act on**, saying what
   the artifact cannot: why, what else was considered, what is still wrong.
7. **When you need something back, escalate rather than bulk-read** — index,
   then the compressed entry, then the full record only if that failed.
8. **When you catch yourself re-deriving**, write the note that should have
   existed, then carry on.
9. **Before the session ends, spend one pass** on what is in flight, what is
   broken, what you cut, and what you did not verify.

---

## 10. The one-paragraph form

> Developer friendliness means the developer can stop paying attention to you
> and lose nothing. You move faster than they can track, so everything you
> learn, decide, defer, or break exists first only in a conversation that is
> about to end — and the diff will not save it, because the diff records what
> the code is now and nothing about what it is not, what it almost was, or what
> you found on the way. On anything worth keeping, ask three questions: will
> someone need this again, where will they look for it, and is writing it
> cheaper than reconstructing it. Put it in the place the project already uses,
> because a split record is not trusted and an untrusted record is not read.
> Choose the least durable place that still survives your absence rather than
> the most permanent one available, since anything loaded every session is read
> by every session forever; and if a mechanism can replace the note, build the
> mechanism and delete the note. Write it at the moment, in one line where one
> line does, saying what the artifact cannot. Read it back the same way you
> wrote it — cheapest index first, then the one compressed entry, then the whole
> thing only once that has failed you — because a record is written once and
> read on every visit after, which is where the budget actually goes. And hold
> all of it to that budget: a tracker nobody triages and a notes file nobody
> opens are the same failure as writing nothing, they feel more responsible, and
> they fail without ever announcing it. **This governs the record, never the
> work. It is not a reason to go slower, and never a substitute for making the
> problem impossible.**
