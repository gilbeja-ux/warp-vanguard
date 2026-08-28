# The drop zone

Put a candidate take here. Any name, any of `.wav`, `.mp3`, `.m4a`, `.ogg`.

The soundboard lists this folder, so a file appears in every cue's picker as soon
as you drop it. Nothing here ships: the build copies `src/audio/sfx/`, and an
implemented take is MOVED up one level into that folder first.

1. Drop the files here.
2. Open the board: `npm run lab:sound`.
3. Pick a file for a cue, set its trim, press SAVE ORDER.
4. Tell Claude: **implement the sfx order**.
