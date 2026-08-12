# Dependency Update Ledger

This ledger records reviewed dependency updates that change the repository
toolchain or CI runtime without changing the product contract. Each entry is
validated by the repository's required checks before merge.

| PR  | Dependency         | Update           | Scope                              |
| --- | ------------------ | ---------------- | ---------------------------------- |
| #26 | Prettier           | 3.8.1 → 3.9.6    | Development formatting tool        |
| #27 | Claude Code Action | 1.0.99 → 1.0.185 | Inactive Claude workflow runtime   |
| #27 | OSV Scanner Action | 2.3.5 → 2.3.8    | Dependency vulnerability scan      |
| #28 | html-validate      | 10.11.3 → 11.6.0 | HTML validation; Node ≥22.22/24.8  |
| #29 | actions/checkout   | v4/v6 → 7.0.1    | GitHub Actions repository checkout |
