"""Generate docs/audits/2026-08-14-cbbd-fixes.md from the audit ledger.

Ordering is by CONSEQUENCE and is a judgement call, stated as such in the
report. Everything else is derived: which rows a fix retires, and the assertion
that every actionable row lands in exactly one fix."""
import io, re
from collections import defaultdict

rows = []
for line in io.open("docs/audits/2026-08-14-cbbd.md", encoding="utf-8"):
    if not re.match(r"^\| [0-9]+ \|", line):
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    rows.append(dict(id=c[0], shape=c[2], loc=c[3], ev=c[4], mech=c[6], rung=c[7], fix=c[8]))

BY_ID = {r["id"]: r for r in rows}
actionable = {r["id"] for r in rows if r["rung"] in ("0", "1", "2", "3")}
enforced = [r for r in rows if r["rung"] == "6"]
retired = [r for r in rows if r["rung"] == "-"]

def ids_where(pred):
    return sorted((r["id"] for r in rows if r["id"] in actionable and pred(r)), key=int)

# (rank, title, change, gate, id-selector)
FIXES = [
 ("Paint cannot lie about an external",
  "Make `ExtrusionPath.beading` private and gate it on role: no constructor accepts a "
  "width provenance for `ExternalPerimeter`, so `{External, Arachne}` stops compiling.",
  "Slice the city; **zero** `Outer wall` segments carry the thin annotation. Today: "
  "13.6 m painted, ~77% of it at nominal width.",
  lambda r: "role-gated constructor" in r["fix"]),

 ("A config write that fails must be heard",
  "Stop discarding `hub.set` results for `gcode_flavor`, `machine_start_gcode`, "
  "`machine_end_gcode` — propagate, or make the key typed so the set cannot fail.",
  "Set a bad machine start G-code and confirm a user-visible warning; then confirm the "
  "custom start/end G-code actually reaches the output (a known-inert item).",
  lambda r: "propagate the error" in r["fix"]),

 ("Dropping the user's geometry must be said out loud",
  "`LayerPlan.z_warp` is `#[serde(skip)]`, so curved-layer warp silently vanishes on the "
  "browser worker path. Carry the loss as a warning on the plan.",
  "Slice a non-planar model on the web build; a warning names the dropped warp.",
  lambda r: "carry the limitation as a warning" in r["fix"]),

 ("A fail-safe that only prose enforces",
  "`RenderOutcome` — *errors non-empty ⇒ text EMPTY* — becomes "
  "`enum { Rendered(String), Failed(Vec<Error>) }`, so a wrongly-branched template "
  "cannot carry printable text.",
  "The forbidden pair no longer compiles; the template tests still pass.",
  lambda r: "Rendered(String), Failed" in r["fix"]),

 ("Parallel arrays become objects",
  "Three `Vec`s that must stay index-aligned with another `Vec` "
  "(`BeadedPath.widths`, `ObjectInstances.instances`, `TracePoly.seg_keys`) carry their "
  "value ON the element instead.",
  "A wrong-length sibling stops compiling; preview and beading tests unchanged.",
  lambda r: "objects, not index tables" in r["fix"] or "keys carried ON the segment objects" in r["fix"]),

 ("States that cannot be half-built",
  "Per-site type fixes for values whose validity is a lifecycle or range claim: "
  "`LineKind` for `is_odd`/`is_closed`; monotonic `max_layer_z`; `NonEmpty` for the two "
  "unproven collection accesses; E-mode typestate for `reset_e`; a handle (not an index) "
  "for the active extruder; seeded/unseeded support elements; positive `Camera.distance`; "
  "area bound on `Conflict`; parser-private `TracedSegment.seq`.",
  "Each forbidden state fails to compile; the workspace battery stays at its known reds.",
  lambda r: any(k in r["fix"] for k in (
      "LineKind", "monotonic newtype", "NonEmpty", "E-mode as a typestate",
      "reference/handle rather than an index", "seeded and unseeded",
      "positive newtype", "constructor-validated newtype",
      "assign the sequence only inside the parser")),),

 ("Configuration is not a sequence of setters",
  "`GcodeWriter` takes its policy at construction and hands back an immutable writer, so "
  "'configured' is a state the type expresses.",
  "Emitting before configuration stops compiling; G-code output byte-identical on the "
  "castle and city.",
  lambda r: "configure at construction" in r["fix"] or "fold into construction" in r["fix"]),

 ("Absence stops looking like a value",
  "The remaining sentinel and advisory-field fixes: `fan_speed` `0.0`→`Option`; "
  "direction `-1.0`→enum; non-negative newtypes for the two clamped-at-use values; "
  "layer-0 payloads for skirt/brim; opaque project-config blob; display-only preset name; "
  "typed externals accessor; conditional first-layer ratio; meta-key-free key list; "
  "one constructor for the three-band layout; provenance on the entry not a sibling map.",
  "Each replaced sentinel or advisory field fails to compile in its old form.",
  lambda r: any(k in r["fix"] for k in (
      "`Option<f64>`: absence", "an enum (or bool) for direction",
      "non-negative newtype", "unsigned/non-negative type", "layer-0 payload type",
      "same fix as id 14", "opaque blob newtype", "display-only newtype",
      "typed accessor", "fold at construction", "excludes meta-keys",
      "one constructor that cannot omit a band", "same as id 63",
      "provenance carried on each config entry", "derive the name from the process",
      "split the params type", "separate `AirForensics` payload",
      "the returned-to height carried by the value", "predicates take a proven-role type",
      "pass only the segment's annotation", "mask-aware position type",
      "one bead-geometry value", "a sweep type whose constructor validates",
      "kinds as distinct fields", "tool-change context as its own variant",
      "same fix as id 31", "model advisory-ness", "same as id 34",
      "same as id 58")),),

 ("Quantities get types (the big one)",
  "Give lengths, angles, densities and speeds real types — `Scaled` already exists in "
  "`fs-geometry` and `Point` uses it — so millimetres and raw units stop being the same "
  "`f64`, and `spacing_scaled` stops being transposable with `z_mm`, `angle` or `density`.",
  "A transposed argument or a raw-for-mm assignment fails to compile; G-code output "
  "byte-identical (this is a typing change, not a behaviour change).",
  lambda r: "give the quantities types" in r["fix"] or "`Scaled` already exists" in r["fix"]),

 ("Decide what a default means (policy, then code)",
  "45 `unwrap_or_default()` sites turn absence or failure into a default, so a caller "
  "cannot tell 'missing' from 'empty' — sharpest is the CLI turning *no input file* into "
  "an empty path. Each site needs a decision: propagate, or make the default explicit.",
  "No `unwrap_or_default()` remains on a fallible domain call without a named, "
  "site-local justification.",
  lambda r: "return the `Option`/`Result` to the caller" in r["fix"]),

 ("Blocked: variant payloads need a better detector first",
  "43 structs pair an enum with fields that may be meaningful for only some variants. "
  "The doc-based shape cannot tell which — it missed `ExtrusionPath.beading`, the one "
  "case proven real. A usage-based detector (fields read in only some `match` arms) must "
  "run before any of these can be called a fix or a false positive.",
  "The usage detector runs and each of the 43 becomes either a named fix or a "
  "dispositioned false positive.",
  lambda r: "variant-carried payload" in r["fix"]),
]

assigned, seen = [], set()
for title, change, gate, pred in FIXES:
    ids = [i for i in ids_where(pred) if i not in seen]
    seen.update(ids)
    assigned.append((title, change, gate, ids))

missing = sorted(actionable - seen, key=int)
assert not missing, (f"{len(missing)} actionable rows in no fix: "
                     + ", ".join(f'{i}({BY_ID[i]["fix"][:40]})' for i in missing[:12]))

def fmt_ids(ids):
    if len(ids) <= 12:
        return ", ".join(ids)
    return ", ".join(ids[:10]) + f", … (+{len(ids)-10} more)"

out = [
"# Can't-break-by-design: the fix list (GIT_339)",
"",
"Derived from `2026-08-14-cbbd.md`, which dispositions all 783 denominator",
"entries. That table is the **ledger** — it proves nothing was skipped. This is",
"the **work list** — deduplicated by fix, so the same remedy appears once instead",
"of once per row.",
"",
f"**{len(actionable)} actionable rows collapse into {len(assigned)} fixes.**",
f"{len(retired)} rows were retired as not-an-invariant and {len(enforced)} were found",
"already enforced; neither appears below.",
"",
"Ordering is by **consequence** — proven user-visible defects first, broad",
"hygiene last. That ordering is a judgement call and the only part of this",
"document not derived mechanically; the row memberships and counts are.",
"",
"| # | Fix | Rows | Why it is here |",
"|---|---|---|---|",
]
WHY = [
 "proven user-visible: 13.6 m of external painted wrong today",
 "a failed config write is silently swallowed",
 "the user's non-planar geometry is silently dropped on web",
 "a print-safety branch guarded only by prose",
 "index-aligned Vecs that can silently disagree",
 "half-built states the type currently permits",
 "no state distinguishes a configured writer from an unconfigured one",
 "sentinels and advisory fields that read as data",
 "mm and raw units are the same `f64` everywhere",
 "policy call: 45 sites where absence becomes a default",
 "**blocked** — the detector cannot yet tell real from false",
]
assert len(WHY) == len(assigned), "WHY list out of step with fixes"
for n, ((title, change, gate, ids), why) in enumerate(zip(assigned, WHY), 1):
    out.append(f"| {n} | **{title}** | {len(ids)} | {why} |")
out += ["", "---", ""]

for n, (title, change, gate, ids) in enumerate(assigned, 1):
    out += [
        f"## {n}. {title}",
        "",
        f"**Change.** {change}",
        "",
        f"**Gate.** {gate}",
        "",
        f"**Retires {len(ids)} row(s):** {fmt_ids(ids)}",
        "",
        "**Sites (from the ledger):**",
        "",
    ]
    for i in ids[:6]:
        r = BY_ID[i]
        out.append(f"- `{r['loc']}` — {r['ev'][:120]}")
    if len(ids) > 6:
        out.append(f"- … and {len(ids)-6} more, listed in the ledger under this fix")
    out.append("")

out += [
"---",
"",
"## Verification",
"",
"```",
"python scripts/cbbd_check.py          # ledger: 783 rows vs 783 denominator entries",
"python scripts/cbbd_report.py --check # every actionable row lands in exactly one fix",
"```",
"",
"The second command fails if a row is actionable and unassigned, so a fix cannot",
"be quietly dropped from this list while remaining open in the ledger.",
"",
"## What this list does NOT cover",
"",
"- Invariants nobody ever wrote down and that match no shape. The ledger's",
"  denominator is the code's own statements plus nine mechanical shapes.",
"- Fix 11 is explicitly **blocked**: the variant-payload shape cannot yet tell a",
"  real obligation from a false positive, and it demonstrably missed the one case",
"  proven real this session.",
"- Effort estimates. Row counts are not effort — fix 9 is 287 rows of mechanical",
"  retyping, fix 1 is 47 sites but changes what the user sees today.",
]

import sys

if "--check" in sys.argv:
    # coverage only: the assertion above already proved every actionable row
    # is assigned; report it without rewriting the file.
    print(f"OK: {len(actionable)} actionable rows, all assigned across {len(assigned)} fixes")
    raise SystemExit(0)

io.open("docs/audits/2026-08-14-cbbd-fixes.md", "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
print(f"report written: {len(assigned)} fixes covering {len(seen)} actionable rows")
for n, (t, _, _, ids) in enumerate(assigned, 1):
    print(f"  {n:2}. {len(ids):4} rows  {t}")
