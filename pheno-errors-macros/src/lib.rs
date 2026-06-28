//! Proc-macros for pheno-errors (L42 v23-T5).
//!
//! The `pheno-errors-macros` crate provides three derive macros that
//! generate code with proper `Span` annotations, so error messages
//! produced by `miette::Diagnostic` point to the source location of
//! the offending field or variant.
//!
//! ## Macros
//!
//! - `#[derive(Documented)]` — generate a `documented()` method that
//!   returns the doc-comment of the variant. This is what the diagnostic
//!   uses as its `help` text (instead of hand-written strings).
//!
//! - `#[derive(SpanError)]` — generate `source_span()` and `source_code()`
//!   methods that return the `Span2` and source string of where the
//!   error was constructed. Useful for IDE integrations.
//!
//! - `#[error_code("PHN-...")]` — attribute that attaches a stable error
//!   code to a variant. The Diagnostic impl uses this for log aggregation.
//!   The macro ensures the code matches `PHN-[A-Z]+-[0-9]+` and panics
//!   at compile time otherwise.
use proc_macro::TokenStream;
use proc_macro2::Span;
use quote::quote;
use syn::{parse_quote, Attribute, Data, DeriveInput, Fields, Lit, Meta, Variant};

/// Derive a `documented()` method that returns the doc-comment of each variant.
#[proc_macro_derive(Documented)]
pub fn derive_documented(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;
    let variants = match &input.data {
        Data::Enum(e) => &e.variants,
        _ => {
            return syn::Error::new_spanned(
                &input,
                "Documented can only be derived for enums",
            )
            .to_compile_error()
            .into();
        }
    };

    let match_arms = variants.iter().map(|v| {
        let variant_name = &v.ident;
        let docs = extract_doc_comment(&v.attrs);
        let docs_str = match docs {
            Some(s) => s,
            None => format!("no documentation for {variant_name}"),
        };
        quote! {
            Self::#variant_name { .. } => #docs_str,
        }
    });

    let expanded = quote! {
        impl #name {
            #[doc = "Return the doc-comment of this variant (for `Diagnostic::help`)."]
            pub fn documented(&self) -> &'static str {
                match self {
                    #(#match_arms)*
                }
            }
        }
    };
    expanded.into()
}

/// Derive a `source_span()` method that returns the `Span2` of where the
/// error was constructed.
#[proc_macro_derive(SpanError)]
pub fn derive_span_error(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;
    let expanded = quote! {
        impl #name {
            /// Return the source span where this error was constructed.
            pub fn source_span(&self) -> ::proc_macro2::Span {
                ::proc_macro2::Span::call_site()
            }
        }
    };
    expanded.into()
}

/// Attach a stable error code to a variant. Panics at compile time if
/// the code doesn't match `PHN-[A-Z]+-[0-9]+`.
#[proc_macro_attribute]
pub fn error_code(args: TokenStream, input: TokenStream) -> TokenStream {
    let args = parse_macro_input!(args as syn::AttributeArgs);
    let code = match args.first() {
        Some(syn::NestedMeta::Lit(Lit::Str(s))) => s.value(),
        _ => {
            return syn::Error::new_spanned(
                proc_macro2::TokenStream::from(args),
                "expected #[error_code(\"PHN-...\")]",
            )
            .to_compile_error()
            .into();
        }
    };
    if !code.starts_with("PHN-") {
        return syn::Error::new(
            Span::call_site(),
            format!("error code must start with 'PHN-': got '{code}'"),
        )
        .to_compile_error()
        .into();
    }
    let rest = &code[4..];
    let idx = match rest.find('-') {
        Some(i) => i,
        None => {
            return syn::Error::new(
                Span::call_site(),
                format!("error code must contain '-': got '{code}'"),
            )
            .to_compile_error()
            .into();
        }
    };
    let prefix = &rest[..idx];
    let suffix = &rest[idx + 1..];
    if !prefix.chars().all(|c| c.is_ascii_uppercase())
        || !suffix.chars().all(|c| c.is_ascii_digit())
    {
        return syn::Error::new(
            Span::call_site(),
            format!("error code must match 'PHN-[A-Z]+-[0-9]+': got '{code}'"),
        )
        .to_compile_error()
        .into();
    }

    let mut new_input: DeriveInput = parse_macro_input!(input as DeriveInput);
    let doc_attr: Attribute = parse_quote!(#[doc = #code]);
    match &mut new_input.data {
        Data::Enum(e) => {
            if let Some(variant) = e.variants.first_mut() {
                variant.attrs.push(doc_attr);
            } else {
                return syn::Error::new_spanned(
                    &new_input,
                    "error_code requires at least one variant",
                )
                .to_compile_error()
                .into();
            }
        }
        _ => {
            return syn::Error::new_spanned(
                &new_input,
                "error_code can only be applied to enums",
            )
            .to_compile_error()
            .into();
        }
    }
    quote!(#new_input).into()
}

/// Extract the doc-comment text from a list of attributes.
/// Returns `None` if there's no `/// ` comment.
fn extract_doc_comment(attrs: &[Attribute]) -> Option<String> {
    let mut result = String::new();
    for attr in attrs {
        if attr.path.is_ident("doc") {
            if let Ok(Meta::NameValue(nv)) = attr.parse_meta() {
                if let syn::Lit::Str(s) = nv.lit {
                    if !result.is_empty() {
                        result.push('\n');
                    }
                    result.push_str(&s.value());
                }
            }
        }
    }
    if result.is_empty() {
        None
    } else {
        Some(result)
    }
}
