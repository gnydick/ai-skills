// The ONLY place hook JSON is written (spec I19). One document per call.
const write = (doc) => process.stdout.write(JSON.stringify(doc) + '\n');
export function updatedInput(toolInput) {
  write({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: toolInput } });
}
export function context(text, event = 'UserPromptSubmit') {
  write({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
}
export function none() {}
