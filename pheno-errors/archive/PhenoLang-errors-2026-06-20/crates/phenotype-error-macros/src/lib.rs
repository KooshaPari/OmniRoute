//! Phenotype Error Macros
//!
//! Procedural macros for unified error handling in the Phenotype ecosystem.

use proc_macro::TokenStream;

/// Derive macro for adding context methods to error types.
#[proc_macro_derive(ErrorContext)]
pub fn derive_error_context(input: TokenStream) -> TokenStream {
    let input = syn::parse_macro_input!(input as syn::DeriveInput);
    let name = &input.ident;

    quote::quote! {
        impl #name {
            /// Get the error code for this error
            #[must_use]
            pub fn error_code(&self) -> &'static str {
                stringify!(#name)
            }

            /// Check if this error matches a given code
            #[must_use]
            pub fn is(&self, code: &str) -> bool {
                self.error_code() == code
            }
        }
    }
    .into()
}

/// Derive macro for generating `From` implementations between error types.
#[proc_macro_derive(ErrorFrom)]
pub fn derive_error_from(input: TokenStream) -> TokenStream {
    let input = syn::parse_macro_input!(input as syn::DeriveInput);
    let name = &input.ident;

    quote::quote! {
        impl #name {
            /// Create error from another error type
            #[allow(clippy::result_expect_used)]
            pub fn from_error<E>(err: E) -> Self
            where
                E: std::convert::Into<Box<dyn std::error::Error + Send + Sync>>,
            {
                Self::Other(err.into().to_string())
            }
        }
    }
    .into()
}
