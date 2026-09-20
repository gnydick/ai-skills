// Generic, reversible: text ↔ a Markdown block quote. unquote(quote(t)) === t for every t, which is
// what lets the gate prove a dictation note still holds its inbox entry byte for byte (#132 § 9 leg 2).
export const quote = (text) => text.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n');

export function unquote(block) {
  return block.split('\n').map((l) => {
    if (l === '>') return '';
    if (l.startsWith('> ')) return l.slice(2);
    throw new Error(`not a block quote line: '${l}'`);
  }).join('\n');
}
