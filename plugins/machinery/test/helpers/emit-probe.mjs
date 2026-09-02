import * as emit from '../../scripts/lib/emit.mjs';
const fn = process.env.PROBE_FN, arg = process.env.PROBE_ARG;
if (fn === 'updatedInput') emit.updatedInput(JSON.parse(arg));
else if (fn === 'context') emit.context(arg, 'UserPromptSubmit');
else emit.none();
