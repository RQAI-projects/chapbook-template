# Glyph artwork

Line icons are Tabler Icons, licensed under MIT: https://tabler.io/icons.

`src/data/emoji-glyphs.json` contains unmodified Twemoji SVG artwork (only JSON-encoded for build-time lookup). Copyright 2020 Twitter, Inc and other contributors. Graphics licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/. Source: https://github.com/discord/twemoji, version 15.1.0.

Only the selected colour glyph is inlined into a post; the full catalogue is never sent to readers. Posts using a colour glyph display a Twemoji attribution link. This build-time catalogue removes the runtime dependency on Chapbook's asset host.
