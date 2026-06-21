{
  "description": "Phenotype monorepo dev shell (T2 v13 — L30.1 reproducible builds)",
  "inputs": {
    "nixpkgs": {
      "url": "github:NixOS/nixpkgs/nixos-unstable",
      "follows": ["pheno/nixpkgs"]
    },
    "rust-overlay": {
      "url": "github:oxalica/rust-overlay",
      "inputs": {
        "nixpkgs": ["nixpkgs"]
      }
    }
  },
  "outputs": { _: { } }
}
