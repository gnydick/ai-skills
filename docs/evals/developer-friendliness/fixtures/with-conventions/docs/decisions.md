# Decisions

## Store amounts as integer minor units
Partner feeds disagree on decimal separators and one of them emits
scientific notation past 1e6. Parsing to `int` cents at the boundary means
the ambiguity is resolved once, where the feed is known.
Rejected: `Decimal` throughout — correct, but every downstream consumer
would have to learn it, and two of them are shell scripts.

## Normalize on import, not on read
Read-time normalization was measurably fine, but three consumers had each
grown their own slightly different version of it.
Rejected: a shared normalize helper — a helper a call site can skip is not
a guarantee, and one call site had already skipped it.
