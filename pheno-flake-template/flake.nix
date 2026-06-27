{
  description = "Phenotype substrate flake template (per ADR-039)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system;
          overlays = overlays;
        };
        rustToolchain = pkgs.rust-bin.stable."1.81.0".default.override {
          extensions = [ "rustfmt" "clippy" "rust-src" "rust-analyzer" ];
        };
      in
      {
        # The development shell: everything a pheno-* maintainer needs
        # to run the full test matrix on their MacBook (with Nix installed)
        # or a heavy runner.
        devShells.default = pkgs.mkShell {
          name = "pheno-substrate-dev";
          buildInputs = with pkgs; [
            rustToolchain
            
            # Core build tooling
            pkg-config
            openssl
            sqlite
            
            # Linting + formatting
            cargo-audit
            cargo-deny
            cargo-outdated
            cargo-udeps
            cargo-machete
            cargo-bloat
            
            # Testing
            cargo-nextest
            cargo-mutants
            cargo-fuzz
            cargo-miri
            
            # Observability
            protobuf
            buf
            
            # Documentation
            mdbook
            mdbook-linkcheck
            
            # CI parity (so MacBook runs match what the heavy runner sees)
            act
            shellcheck
            actionlint
          ];
          
          shellHook = ''
            echo "Phenotype substrate dev shell (per ADR-039)"
            echo "Rust:    $(rustc --version)"
            echo "Cargo:   $(cargo --version)"
            echo "Audit:   $(cargo audit --version 2>/dev/null || echo 'not installed')"
            echo "Nextest: $(cargo nextest --version 2>/dev/null || echo 'not installed')"
            echo ""
            echo "Quickstart:"
            echo "  cargo test --workspace     # full test matrix"
            echo "  cargo bench --workspace    # criterion benchmarks"
            echo "  cargo +nightly miri run    # MIR interpreter for unsafe"
            echo "  cargo fuzz run <target>    # libFuzzer integration"
            echo "  cargo machete             # find unused dependencies"
            echo "  cargo bloat --release      # binary size analysis"
            echo "  actionlint                # GitHub Actions workflow lint"
            echo ""
          '';
          
          # Per ADR-039: lock the environment so MacBook == CI == heavy runner
          CARGO_HOME = "$HOME/.cargo";
          RUSTUP_HOME = "$HOME/.rustup";
        };
        
        # The flake check (verifies the devShell builds, takes ~30s)
        checks.default = self.checks.${system}.devShell;
      });
}
