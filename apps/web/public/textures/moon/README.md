# Globe texture (generated, git-ignored)

This directory is filled by:

```bash
uv run lunaris-data acquire nasa-svs-cgi-moon-kit
uv run lunaris-data build-web-texture
```

which writes `moon-color.jpg` and `manifest.json` (provenance: source dataset, file
checksum, retrieval time, credit, projection assumptions). When `manifest.json` is
absent, the web client renders a clearly labeled **procedural placeholder surface**.
The texture is for visualization only and is never used for analysis.
