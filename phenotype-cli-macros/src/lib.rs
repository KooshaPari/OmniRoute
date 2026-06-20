// SPDX-License-Identifier: MIT OR Apache-2.0
//! # phenotype-cli-macros
//!
//! Procedural macros for standardizing CLI patterns across Phenotype CLIs.
//!
//! ## Macros
//!
//! | Macro | Kind | Purpose |
//! |-------|------|---------|
//! | [`PhenotypeSubcommand`] (derive) | Derive macro | Injects standard subcommand variants (`Default`, `Version`) into a `clap::Subcommand` enum |
//! | [`cli_common!`] | Function-like proc-macro | Generates a `clap::Args` struct with standard global flags (verbose, config, output, dry-run) |
//!
//! ## Quick start
//!
//! ```ignore
//! use clap::{Parser, Subcommand};
//! use phenotype_cli_macros::{cli_common, PhenotypeSubcommand};
//!
//! // Generate the shared global-args struct
//! cli_common!(GlobalArgs);
//!
//! // Use in your top-level CLI
//! #[derive(Parser, Debug)]
//! #[command(name = "mycli")]
//! struct Cli {
//!     #[command(flatten)]
//!     pub globals: GlobalArgs,
//!
//!     #[command(subcommand)]
//!     pub command: Option<Command>,
//! }
//!
//! #[derive(PhenotypeSubcommand, Subcommand, Debug)]
//! enum Command {
//!     /// Build something
//!     Build {
//!         #[arg(short, long)]
//!         target: String,
//!     },
//! }
//! // `Command` now has Default + Version variants injected automatically.
//! ```

use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::{format_ident, quote};
use syn::{parse_macro_input, Data, DataEnum, DeriveInput, Ident, Variant};

// ---------------------------------------------------------------------------
// Derive: PhenotypeSubcommand
// ---------------------------------------------------------------------------

/// Derive macro that injects standard subcommand variants into a
/// `clap::Subcommand` enum.
///
/// The injected variants are:
/// - `Default` — no subcommand given (default action)
/// - `Version` — `version` subcommand to print version info
///
/// # Usage
///
/// ```ignore
/// use clap::Subcommand;
/// use phenotype_cli_macros::PhenotypeSubcommand;
///
/// #[derive(PhenotypeSubcommand, Subcommand, Debug)]
/// enum Command {
///     Init { path: String },
/// }
///
/// // Equivalent to:
/// #[derive(Subcommand, Debug)]
/// enum Command {
///     Default,
///     Version,
///     Init { path: String },
/// }
/// ```
#[proc_macro_derive(PhenotypeSubcommand)]
pub fn derive_phenotype_subcommand(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    expand_phenotype_subcommand(input).into()
}

fn expand_phenotype_subcommand(input: DeriveInput) -> TokenStream2 {
    let name = &input.ident;
    let (impl_generics, ty_generics, where_clause) = input.generics.split_for_impl();

    // Parse existing variants
    let existing_variants = match &input.data {
        Data::Enum(DataEnum { variants, .. }) => variants,
        _ => {
            return syn::Error::new_spanned(
                &input,
                "PhenotypeSubcommand can only be derived on enums",
            )
            .to_compile_error();
        }
    };

    // Build the full variant list: Default, Version, then original variants
    let default_variant = syn::parse2::<Variant>(quote! {
        /// Show task summary (default action when no subcommand is given).
        Default
    })
    .unwrap();

    let version_variant = syn::parse2::<Variant>(quote! {
        /// Print version information.
        Version
    })
    .unwrap();

    let variants: Vec<&Variant> = std::iter::once(&default_variant)
        .chain(std::iter::once(&version_variant))
        .chain(existing_variants.iter())
        .collect();

    // Build match arms for helper methods
    let default_arm = {
        let v = &default_variant;
        let v_ident = &v.ident;
        quote! { #name::#v_ident => true }
    };
    let other_default_arms = variants[2..].iter().map(|v| {
        let i = &v.ident;
        match &v.fields {
            syn::Fields::Named(_) | syn::Fields::Unnamed(_) => {
                quote! { #name::#i(..) => false }
            }
            syn::Fields::Unit => {
                quote! { #name::#i => false }
            }
        }
    });

    let version_arm = {
        let v = &version_variant;
        let v_ident = &v.ident;
        quote! { #name::#v_ident => true }
    };
    let other_version_arms = variants[2..].iter().map(|v| {
        let i = &v.ident;
        match &v.fields {
            syn::Fields::Named(_) | syn::Fields::Unnamed(_) => {
                quote! { #name::#i(..) => false }
            }
            syn::Fields::Unit => {
                quote! { #name::#i => false }
            }
        }
    });

    quote! {
        #input

        impl #impl_generics #name #ty_generics #where_clause {
            /// Returns `true` if this is the `Default` variant
            /// (no subcommand was given).
            pub fn is_default(&self) -> bool {
                match self {
                    #default_arm,
                    #(#other_default_arms),*
                }
            }

            /// Returns `true` if this is the `Version` variant.
            pub fn is_version(&self) -> bool {
                match self {
                    #version_arm,
                    #(#other_version_arms),*
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Proc macro: cli_common!
// ---------------------------------------------------------------------------

/// Function-like procedural macro that generates a standard
/// `clap::Args` struct with the common CLI flags shared across
/// Phenotype CLIs.
///
/// The generated struct includes these fields (all controllable via
/// the configuration syntax):
///
/// | Field | Flag | Description |
/// |-------|------|-------------|
/// | `config` | `-c` / `--config` / `PHENOTYPE_CONFIG` env | Config file path |
/// | `verbose` | `-v` / `--verbose` (count) | Log verbosity |
/// | `quiet` | `-q` / `--quiet` | Suppress non-error output |
/// | `output` | `--output` | Output format (human/json/yaml) |
/// | `dry_run` | `--dry-run` | Print what would be done without executing |
///
/// # Usage
///
/// ## Simplest form — includes all fields
///
/// ```ignore
/// cli_common!(GlobalArgs);
/// ```
///
/// This expands to a struct named `GlobalArgs` with all five standard
/// fields plus an `OutputFormat` enum and convenience methods.
///
/// ## Explicit configuration
///
/// ```ignore
/// cli_common!(GlobalArgs {
///     verbose: true,
///     config: true,
///     output: true,
///     dry_run: true,
/// });
/// ```
///
/// Each field can be toggled on (`true`) or off (`false`). Omitted fields
/// default to `true`.
#[proc_macro]
pub fn cli_common(input: TokenStream) -> TokenStream {
    let tokens = proc_macro2::TokenStream::from(input);
    expand_cli_common(tokens).into()
}

struct CliCommonConfig {
    struct_name: Ident,
    verbose: bool,
    config: bool,
    output: bool,
    dry_run: bool,
}

fn expand_cli_common(input: TokenStream2) -> TokenStream2 {
    // Parse the input: either just an ident, or ident { fields }
    let config = if input.is_empty() {
        return syn::Error::new(
            proc_macro2::Span::call_site(),
            "cli_common! requires a struct name, e.g. cli_common!(GlobalArgs)",
        )
        .to_compile_error();
    } else {
        // Try to parse as "Ident { ... }" first
        if let Ok(parsed) = syn::parse2::<CliCommonInput>(input.clone()) {
            CliCommonConfig {
                struct_name: parsed.struct_name,
                verbose: parsed.fields.verbose.unwrap_or(true),
                config: parsed.fields.config.unwrap_or(true),
                output: parsed.fields.output.unwrap_or(true),
                dry_run: parsed.fields.dry_run.unwrap_or(true),
            }
        } else {
            // Fallback: just an ident
            let struct_name: Ident = syn::parse2(input.clone())
                .map_err(|e| {
                    syn::Error::new(
                        proc_macro2::Span::call_site(),
                        format!(
                            "expected `StructName` or `StructName {{ ... }}`, got: {}",
                            e,
                        ),
                    )
                })
                .unwrap_or_else(|e| panic!("{}", e));
            CliCommonConfig {
                struct_name,
                verbose: true,
                config: true,
                output: true,
                dry_run: true,
            }
        }
    };

    let name = &config.struct_name;
    let output_enum_name = format_ident!("{}OutputFormat", name);
    let filter_fn_name = format_ident!("{}_log_filter", snake_case(&name.to_string()));

    // Conditionally include fields
    let config_field = config.config.then(|| {
        quote! {
            /// Path to the config file (YAML/TOML/JSON).
            #[arg(short, long, global = true, env = "PHENOTYPE_CONFIG")]
            pub config: Option<std::path::PathBuf>,
        }
    });

    let verbose_field = config.verbose.then(|| {
        quote! {
            /// Increase log verbosity (-v, -vv, -vvv).
            #[arg(short, long, global = true, action = clap::ArgAction::Count)]
            pub verbose: u8,
        }
    });

    let quiet_field = config.verbose.then(|| {
        quote! {
            /// Suppress non-error output.
            #[arg(short = 'q', long, global = true)]
            pub quiet: bool,
        }
    });

    let output_field = config.output.then(|| {
        quote! {
            /// Output format (human, json, yaml).
            #[arg(long, global = true, default_value = "human", value_enum)]
            pub output: #output_enum_name,
        }
    });

    let dry_run_field = config.dry_run.then(|| {
        quote! {
            /// Print what would be done without executing.
            #[arg(long, global = true)]
            pub dry_run: bool,
        }
    });

    let output_enum = config.output.then(|| {
        quote! {
            /// Output format options.
            #[derive(clap::ValueEnum, Debug, Clone, Copy, Default, PartialEq, Eq)]
            pub enum #output_enum_name {
                /// Human-readable output.
                #[default]
                Human,
                /// JSON-formatted output.
                Json,
                /// YAML-formatted output.
                Yaml,
            }

            impl std::fmt::Display for #output_enum_name {
                fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                    match self {
                        #output_enum_name::Human => write!(f, "human"),
                        #output_enum_name::Json => write!(f, "json"),
                        #output_enum_name::Yaml => write!(f, "yaml"),
                    }
                }
            }
        }
    });

    // Generate helper methods
    let verbosity_method = config.verbose.then(|| {
        quote! {
            /// Convert verbosity settings to a log-level string suitable for
            /// `tracing-subscriber` / `env_logger`.
            ///
            /// - `--quiet`      → `"error"`
            /// - (default)       → `"info"`
            /// - `-v`            → `"debug"`
            /// - `-vv` (or more) → `"trace"`
            pub fn #filter_fn_name(&self) -> &'static str {
                match (self.verbose, self.quiet) {
                    (_, true) => "error",
                    (0, false) => "info",
                    (1, false) => "debug",
                    _ => "trace",
                }
            }
        }
    });

    let is_dry_run_method = config.dry_run.then(|| {
        quote! {
            /// Returns `true` if `--dry-run` was passed.
            pub fn is_dry_run(&self) -> bool {
                self.dry_run
            }
        }
    });

    let is_quiet_method = config.verbose.then(|| {
        quote! {
            /// Returns `true` if `--quiet` was passed.
            pub fn is_quiet(&self) -> bool {
                self.quiet
            }
        }
    });

    quote! {
        #output_enum

        #[derive(clap::Args, Debug, Clone)]
        pub struct #name {
            #config_field
            #verbose_field
            #quiet_field
            #output_field
            #dry_run_field
        }

        impl #name {
            #verbosity_method
            #is_dry_run_method
            #is_quiet_method
        }
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Parse helper for `Ident { fields }` syntax.
struct CliCommonInput {
    struct_name: Ident,
    fields: CliCommonFields,
}

impl syn::parse::Parse for CliCommonInput {
    fn parse(input: syn::parse::ParseStream<'_>) -> syn::Result<Self> {
        let struct_name: Ident = input.parse()?;
        let content;
        syn::braced!(content in input);
        let fields: CliCommonFields = content.parse()?;
        Ok(CliCommonInput { struct_name, fields })
    }
}

struct CliCommonFields {
    verbose: Option<bool>,
    config: Option<bool>,
    output: Option<bool>,
    dry_run: Option<bool>,
}

impl syn::parse::Parse for CliCommonFields {
    fn parse(input: syn::parse::ParseStream<'_>) -> syn::Result<Self> {
        let mut fields = CliCommonFields {
            verbose: None,
            config: None,
            output: None,
            dry_run: None,
        };

        while !input.is_empty() {
            let key: Ident = input.parse()?;
            let _: syn::Token![:] = input.parse()?;
            let value: syn::LitBool = input.parse()?;

            match key.to_string().as_str() {
                "verbose" => fields.verbose = Some(value.value()),
                "config" => fields.config = Some(value.value()),
                "output" => fields.output = Some(value.value()),
                "dry_run" => fields.dry_run = Some(value.value()),
                other => {
                    return Err(syn::Error::new_spanned(
                        key,
                        format!("unknown field `{}`, expected one of: verbose, config, output, dry_run", other),
                    ));
                }
            }

            // Allow trailing comma
            if !input.is_empty() {
                let _ = input.parse::<syn::Token![,]>();
            }
        }

        Ok(fields)
    }
}

/// Convert CamelCase to snake_case.
///
/// Handles consecutive uppercase letters (acronyms) correctly:
/// - `"MyCLI"` → `"my_cli"`
/// - `"MyCLIStuff"` → `"my_cli_stuff"`
fn snake_case(ident: &str) -> String {
    let mut result = String::with_capacity(ident.len() + 5);
    let chars: Vec<char> = ident.chars().collect();
    for i in 0..chars.len() {
        let ch = chars[i];
        if ch.is_uppercase() {
            if i > 0 {
                let prev = chars[i - 1];
                let next = chars.get(i + 1);
                // Start a new word if the previous char is lowercase,
                // or (the next char exists and is lowercase).
                if prev.is_lowercase() || next.map_or(false, |n| n.is_lowercase()) {
                    result.push('_');
                }
            }
            for lower in ch.to_lowercase() {
                result.push(lower);
            }
        } else {
            result.push(ch);
        }
    }
    result
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_snake_case() {
        assert_eq!(snake_case("GlobalArgs"), "global_args");
        assert_eq!(snake_case("OutputFormat"), "output_format");
        assert_eq!(snake_case("MyCLI"), "my_cli");
        assert_eq!(snake_case("MyCLIStuff"), "my_cli_stuff");
        assert_eq!(snake_case("simple"), "simple");
        assert_eq!(snake_case("ABC"), "abc");
    }

    #[test]
    fn test_phenotype_subcommand_expands() {
        let input: DeriveInput = syn::parse2(quote! {
            #[derive(PhenotypeSubcommand, Subcommand, Debug)]
            enum Command {
                /// Create a resource.
                Create {
                    #[arg(short, long)]
                    name: String,
                },
            }
        })
        .unwrap();

        let output = expand_phenotype_subcommand(input);
        let code = output.to_string();

        // Check that Default and Version variants were injected
        assert!(
            code.contains("Default"),
            "output should contain Default variant"
        );
        assert!(
            code.contains("Version"),
            "output should contain Version variant"
        );
        assert!(code.contains("Create"), "output should contain Create variant");
        assert!(
            code.contains("is_default"),
            "output should contain is_default method"
        );
        assert!(
            code.contains("is_version"),
            "output should contain is_version method"
        );
    }

    #[test]
    fn test_cli_common_expands_struct() {
        let input: TokenStream2 = quote! { GlobalArgs };
        let output = expand_cli_common(input);
        let code = output.to_string();

        assert!(code.contains("struct GlobalArgs"));
        assert!(code.contains(r"pub config : Option < std :: path :: PathBuf >"));
        assert!(code.contains("pub verbose : u8"));
        assert!(code.contains("pub quiet : bool"));
        assert!(code.contains("pub output : GlobalArgsOutputFormat"));
        assert!(code.contains("pub dry_run : bool"));
        assert!(code.contains("enum GlobalArgsOutputFormat"));
        assert!(code.contains("Human"));
        assert!(code.contains("Json"));
        assert!(code.contains("Yaml"));
    }

    #[test]
    fn test_cli_common_with_config() {
        let input: TokenStream2 = quote! {
            MyArgs {
                verbose: true,
                config: false,
                output: true,
                dry_run: false,
            }
        };
        let output = expand_cli_common(input);
        let code = output.to_string();

        assert!(code.contains("struct MyArgs"));
        assert!(
            !code.contains("pub config :"),
            "config field should be omitted when config: false"
        );
        assert!(code.contains("pub verbose : u8"));
        assert!(!code.contains("pub dry_run :"), "dry_run field should be omitted when dry_run: false");
        assert!(code.contains("enum MyArgsOutputFormat"));
        assert!(code.contains("pub fn my_args_log_filter"));
    }

    #[test]
    fn test_cli_common_empty_input_fails() {
        let input = TokenStream2::new();
        let output = expand_cli_common(input);
        let code = output.to_string();
        // Should produce a compile error, not a panic
        assert!(
            code.contains("compile_error"),
            "empty input should produce compile_error"
        );
    }

    #[test]
    fn test_phenotype_subcommand_on_non_enum_fails() {
        let input: DeriveInput = syn::parse2(quote! {
            #[derive(PhenotypeSubcommand)]
            struct NotAnEnum {
                field: String,
            }
        })
        .unwrap();

        let output = expand_phenotype_subcommand(input);
        let code = output.to_string();
        assert!(
            code.contains("compile_error"),
            "struct input should produce compile_error"
        );
    }

    #[test]
    fn test_verbosity_helper_without_verbose() {
        let input: TokenStream2 = quote! {
            SimpleArgs {
                verbose: false,
                config: false,
                output: false,
                dry_run: false,
            }
        };
        let output = expand_cli_common(input);
        let code = output.to_string();

        assert!(
            !code.contains("pub fn simple_args_log_filter"),
            "log_filter method should not be generated when verbose: false"
        );
        assert!(
            !code.contains("pub verbose:"),
            "verbose field should not be present"
        );
        assert!(
            !code.contains("pub quiet:"),
            "quiet field should not be present"
        );
        assert!(
            !code.contains("OutputFormat"),
            "OutputFormat should not be present when output: false"
        );
    }
}
