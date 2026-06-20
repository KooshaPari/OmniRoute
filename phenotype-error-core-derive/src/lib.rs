//! Proc-macro derive for the [`PhenotypeErrorTrait`].
//!
//! # Usage
//!
//! ```ignore
//! use phenotype_error_core::PhenotypeErrorTrait;
//! use phenotype_error_core_derive::PhenotypeError;
//!
//! #[derive(Debug, PhenotypeError)]
//! enum MyError {
//!     #[phenotype_error(code = "NotFound")]
//!     NotFound(String),
//!
//!     #[phenotype_error(code = "ValidationError")]
//!     Validation { field: String, reason: String },
//!
//!     #[phenotype_error(code = "InternalError", retryable)]
//!     Storage(String),
//! }
//! ```
//!
//! This generates implementations of `Display`, `Error`, and `PhenotypeErrorTrait`.
//!
//! ## Attributes
//!
//! Each variant must have a `#[phenotype_error(code = "...")]` annotation.
//! Supported error codes match the [`ErrorCode`] enum variants.
//! Add `retryable` as a second attribute flag to make the error retryable.

use proc_macro::TokenStream;
use quote::quote;
use syn::{
    parse_macro_input, Attribute, Data, DeriveInput, Expr, Fields, Lit, Meta, MetaNameValue,
    Token,
};

/// Read a `#[phenotype_error(crate = "...")]` attribute from the container
/// (enum level) and return the path to use when referencing the
/// `phenotype-error-core` crate. Defaults to `::phenotype_error_core`.
fn crate_path_from_attrs(attrs: &[Attribute]) -> syn::Path {
    for attr in attrs {
        if !attr.path().is_ident("phenotype_error") {
            continue;
        }
        let Meta::List(list) = &attr.meta else { continue };
        if let Ok(Meta::NameValue(MetaNameValue { value, .. })) =
            list.parse_args::<Meta>()
        {
            if let Expr::Lit(sync_lit) = value {
                if let syn::Lit::Str(s) = &sync_lit.lit {
                    let path: syn::Path = s.parse().unwrap_or_else(|_| {
                        syn::parse_str("::phenotype_error_core").unwrap()
                    });
                    return path;
                }
            }
        }
    }
    syn::parse_str("::phenotype_error_core").unwrap()
}

/// Derive `PhenotypeErrorTrait` for an error enum.
///
/// Each variant must be annotated with `#[phenotype_error(code =
/// "ErrorCodeVariant")]`. Optional: `retryable` flag.
#[proc_macro_derive(PhenotypeError, attributes(phenotype_error))]
pub fn derive_phenotype_error(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;
    let (impl_generics, ty_generics, where_clause) = input.generics.split_for_impl();

    let data = match &input.data {
        Data::Enum(e) => e,
        _ => {
            return syn::Error::new_spanned(name, "PhenotypeError can only be derived for enums")
                .to_compile_error()
                .into();
        }
    };

    // Determine the crate path from the container-level attribute,
    // defaulting to `::phenotype_error_core`.
    let crate_path = crate_path_from_attrs(&input.attrs);

    // Collect per-variant info
    let mut display_arms = Vec::new();
    let mut error_code_arms = Vec::new();
    let mut retryable_arms = Vec::new();

    for variant in &data.variants {
        let variant_name = &variant.ident;

        // Read attributes
        let mut phenotype_code: Option<String> = None;
        let mut retryable = false;

        for attr in &variant.attrs {
            if !attr.path().is_ident("phenotype_error") {
                continue;
            }

            let meta = match &attr.meta {
                Meta::List(list) => list,
                other => {
                    return syn::Error::new_spanned(
                        other,
                        "expected #[phenotype_error(code = \"...\")] or #[phenotype_error(code = \"...\", retryable)]",
                    )
                    .to_compile_error()
                    .into();
                }
            };

            let parsed: PhenotypeErrorAttr = meta.parse_args().unwrap_or_else(|e| {
                panic!("{e}");
            });

            if let Some(code) = parsed.code {
                phenotype_code = Some(code);
            }
            retryable = parsed.retryable;
        }

        let code_str = match &phenotype_code {
            Some(c) => c.clone(),
            None => {
                return syn::Error::new_spanned(
                    variant_name,
                    "each variant must have #[phenotype_error(code = \"...\")]",
                )
                .to_compile_error()
                .into();
            }
        };

        // Generate pattern based on variant fields
        let pattern = match &variant.fields {
            Fields::Named(fields) => {
                let idents: Vec<_> = fields.named.iter().map(|f| &f.ident).collect();
                quote! { { #(#idents),* } }
            }
            Fields::Unnamed(_) => {
                quote! { (..) }
            }
            Fields::Unit => quote! {},
        };

        // Display: use Debug for field rendering (user's enum must also derive Debug)
        let display_body = match &variant.fields {
            Fields::Unnamed(fields) if fields.unnamed.len() == 1 => {
                quote! {
                    Self::#variant_name (inner) => write!(f, "{}: {}", stringify!(#variant_name), inner),
                }
            }
            Fields::Unnamed(_) => {
                quote! {
                    Self::#variant_name #pattern => write!(f, "{}: {:?}", stringify!(#variant_name), self),
                }
            }
            Fields::Named(_) => {
                quote! {
                    Self::#variant_name #pattern => write!(f, "{}: {:?}", stringify!(#variant_name), self),
                }
            }
            Fields::Unit => {
                quote! {
                    Self::#variant_name => write!(f, "{}", stringify!(#variant_name)),
                }
            }
        };
        display_arms.push(display_body);

        // ErrorCode mapping
        let code_ident = syn::Ident::new(&code_str, proc_macro2::Span::call_site());
        error_code_arms.push(quote! {
            Self::#variant_name #pattern => #crate_path::ErrorCode::#code_ident,
        });

        // Retryable
        retryable_arms.push(quote! {
            Self::#variant_name #pattern => #retryable,
        });
    }

    let expanded = quote! {
        impl #impl_generics std::fmt::Display for #name #ty_generics #where_clause {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                match self {
                    #(#display_arms)*
                }
            }
        }

        impl #impl_generics std::error::Error for #name #ty_generics #where_clause {}

        impl #impl_generics #crate_path::PhenotypeErrorTrait for #name #ty_generics #where_clause {
            fn error_code(&self) -> #crate_path::ErrorCode {
                match self {
                    #(#error_code_arms)*
                }
            }

            fn is_retryable(&self) -> bool {
                match self {
                    #(#retryable_arms)*
                }
            }

            fn message(&self) -> String {
                self.to_string()
            }

            fn into_canonical(self) -> #crate_path::PhenotypeError {
                let msg = self.to_string();
                let code = self.error_code();
                match code {
                    #crate_path::ErrorCode::NotFound => {
                        #crate_path::PhenotypeError::not_found(msg)
                    }
                    #crate_path::ErrorCode::AlreadyExists => {
                        #crate_path::PhenotypeError::conflict(msg)
                    }
                    #crate_path::ErrorCode::ValidationError => {
                        #crate_path::PhenotypeError::validation(msg)
                    }
                    #crate_path::ErrorCode::InvalidArgument => {
                        #crate_path::PhenotypeError::invalid_input("", msg)
                    }
                    #crate_path::ErrorCode::Timeout => {
                        #crate_path::PhenotypeError::timeout(msg, 0)
                    }
                    #crate_path::ErrorCode::Unauthenticated => {
                        #crate_path::PhenotypeError::authentication(msg)
                    }
                    #crate_path::ErrorCode::PermissionDenied => {
                        #crate_path::PhenotypeError::authorization(msg)
                    }
                    #crate_path::ErrorCode::Cancelled => {
                        #crate_path::PhenotypeError::cancelled(msg)
                    }
                    #crate_path::ErrorCode::ResourceExhausted => {
                        #crate_path::PhenotypeError::rate_limited(msg)
                    }
                    #crate_path::ErrorCode::Unavailable => {
                        #crate_path::PhenotypeError::unavailable(msg)
                    }
                    _ => #crate_path::PhenotypeError::internal(msg),
                }
            }
        }
    };

    expanded.into()
}

/// Parsed `#[phenotype_error(code = "...", retryable)]` attributes.
struct PhenotypeErrorAttr {
    code: Option<String>,
    retryable: bool,
}

impl syn::parse::Parse for PhenotypeErrorAttr {
    fn parse(input: syn::parse::ParseStream) -> syn::Result<Self> {
        let mut code: Option<String> = None;
        let mut retryable_val = false;

        // Parse comma-separated key-value pairs or flags
        while !input.is_empty() {
            // Peek for an identifier (either a flag like `retryable` or a key like `code`)
            if input.peek(syn::Ident) {
                let ident: syn::Ident = input.parse()?;
                let ident_str = ident.to_string();

                if ident_str == "retryable" {
                    retryable_val = true;
                } else if input.peek(Token![=]) {
                    // Key = "value"
                    let _: Token![=] = input.parse()?;
                    let value: Lit = input.parse()?;
                    match ident_str.as_str() {
                        "code" => {
                            if let Lit::Str(s) = value {
                                code = Some(s.value());
                            } else {
                                return Err(syn::Error::new_spanned(
                                    value,
                                    "code value must be a string literal",
                                ));
                            }
                        }
                        other => {
                            return Err(syn::Error::new_spanned(
                                ident,
                                format!("unknown attribute: {other}"),
                            ));
                        }
                    }
                } else {
                    return Err(syn::Error::new_spanned(
                        ident,
                        format!("unknown attribute: {ident_str}"),
                    ));
                }
            }

            // Optional trailing comma
            if !input.is_empty() {
                let _ = input.parse::<Token![,]>();
            }
        }

        Ok(Self { code, retryable: retryable_val })
    }
}
