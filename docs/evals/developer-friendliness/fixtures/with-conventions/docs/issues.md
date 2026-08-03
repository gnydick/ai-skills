# Known issues

## Partner "northgate" sends BOM-prefixed files
Handled by stripping in `importer.read_rows`, but the strip is unconditional
and would corrupt a legitimate leading U+FEFF. Nobody sends one today.

## `uploader.post_batch` has no timeout
Inherited. Hangs indefinitely if settlement stops responding. Needs a
measured value, not a guessed one.
