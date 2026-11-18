# Globe texture (generated, committed)

This directory is filled by:

```bash
uv run lunaris-data acquire nasa-svs-cgi-moon-kit
uv run lunaris-data build-web-texture
```

which writes `moon-color.jpg` and `manifest.json` (provenance: source dataset, file
checksum, retrieval time, credit, projection assumptions). When `manifest.json` is
absent, the web client renders a clearly labeled **procedural placeholder surface**.
The texture is for visualization only and is never used for analysis.

## Why the built files are committed

On 18 November 2026 the Render build of the web image could not download the source
image: `GET https://svs.gsfc.nasa.gov/.../lroc_color_poles_4k.tif` failed with
`CERTIFICATE_VERIFY_FAILED`, so the live site showed the placeholder surface. The two
built files (1.8 MB JPEG, public-domain NASA imagery, provenance in `manifest.json`) are
therefore committed. The Docker texture stage still runs; when it succeeds it overwrites
them with an identical rebuild, and when it fails these files are used. To rebuild, run
the two commands above and commit the result.
