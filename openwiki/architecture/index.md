# Files

- [Contracts, envelopes and the data/ files](contracts-and-data-files.md) - How @poe/contracts defines every cross-package concept as a Zod schema, how versioned file envelopes are loaded and refused, and which data/ files exist, who writes them and who reads them.
- [Package graph, ports and purity boundaries](package-graph-and-ports.md) - The four-package pnpm workspace (contracts -> core -> sync/web), the functional-core and imperative-shell split with Port interfaces and fakes, and the manifest, dependency-cruiser, ESLint and tsconfig guards that enforce it.
