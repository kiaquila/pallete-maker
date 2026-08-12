# Dependency Update Ledger

This ledger records reviewed dependency updates that change the repository
toolchain or CI runtime without changing the product contract. Each entry is
validated by the repository's required checks before merge.

| PR  | Dependency | Update        | Scope                       |
| --- | ---------- | ------------- | --------------------------- |
| #26 | Prettier   | 3.8.1 → 3.9.6 | Development formatting tool |
