# Model identity audit — 2026-10-28

Scope: identity mapping only, using the published Octopus snapshot and the live Artificial Analysis sitemap. No benchmark scores, weights or model estimates were changed.

- CommandCode rows: 99
- Artificial Analysis current sitemap slugs: 449
- Rows with mapped AA slug present in current sitemap: 86
- Rows with AA slug absent from current sitemap: 1
- Unmapped/non-comparable rows: 12
- Unique mapped AA families: 77

## Mapped slug not in current sitemap

- Qwen 3.6 Max Preview → qwen3-max-preview

## Unmapped / non-comparable CommandCode rows

- Laguna S 2.1
- Glyph Cluster
- Beam 1.0
- Tencent Hy4 Preview
- Ornith 1.5 122B
- Ornith 1.5 122B
- Qwen 3.8 Omni Flash
- Qwen 3.8 Max Prime
- Qwen 3.7 Flash
- Fugu Ultra
- Jev
- Jev 1.14.0

## False-positive prevention

- `reflection-beam` is **not** evidence that `Beam 1.0` is the same model.
- `qwen3-5-omni-flash` is **not** evidence that `Qwen 3.8 Omni Flash` is the same generation.
- Experimental proxy status is independent of model identity, and must not count as an AA match.
- Unmapped stealth or decision models remain unscored/non-comparable unless verified independently.

See the CSV for the per-row classification.
