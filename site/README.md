# Site

Static public UI for the benchmark.

- `index.html`: recommended Quality, Balanced and Budget role portfolios, plus Quality and Balanced full-table ranking modes. Portfolio validation enforces 5–8 distinct families and at most two seats per family; the same exact model may occupy both seats of a family when useful.
- `methodology.html`: ranking formula, task-cost normalization, CAI* estimator, reverse validation and role weights.
- `data/`: generated latest snapshot and CAI validation metrics.

Free unresolved models can appear only in the curated top lineups through a documented external-evidence override; they remain excluded from the full scored tables.

- `../data/lineup-opportunities.json` in the repository records dry-run single-seat swap opportunities after each refresh; the public UI does not auto-apply them.

Deployment: `.github/workflows/pages.yml` publishes this directory directly from `octopus-role-benchmarks` to GitHub Pages. The site is not copied into or deployed by the Radar repository.
