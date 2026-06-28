//! Example OIDC consumer: minimal CLI that performs Authorization Code + PKCE flow
//! against a Phenotype OIDC provider, then validates the received ID token.
//!
//! Usage:
//!   cargo run --example oidc_consumer -- --issuer https://phenotype.us.auth0.com \
//!     --client-id <id> --client-secret <secret> --redirect-uri http://127.0.0.1:8080/callback
//!
//! This is a development reference; production consumers should use pheno-context::oidc.

use anyhow::Result;
use clap::Parser;
use pheno_context::oidc::{OidcClient, OidcConfig};

#[derive(Parser, Debug)]
#[command(name = "oidc_consumer")]
struct Args {
    /// OIDC issuer URL (e.g., https://phenotype.us.auth0.com)
    #[arg(long)]
    issuer: String,

    /// OAuth client ID
    #[arg(long)]
    client_id: String,

    /// OAuth client secret
    #[arg(long)]
    client_secret: String,

    /// Redirect URI (must be registered with the IdP)
    #[arg(long)]
    redirect_uri: String,

    /// Scopes (space-separated, default: openid profile email)
    #[arg(long, default_value = "openid profile email")]
    scopes: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();
    let config = OidcConfig {
        issuer: args.issuer.clone(),
        client_id: args.client_id.clone(),
        client_secret: args.client_secret.clone(),
        redirect_uri: args.redirect_uri.clone(),
        scopes: args.scopes.split_whitespace().map(String::from).collect(),
    };

    println!("[1/3] Discovering OIDC endpoints at {}...", args.issuer);
    let client = OidcClient::discover(config).await?;

    let scope_refs: Vec<&str> = args.scopes.split_whitespace().collect();
    let (auth_url, csrf) = client.authorize_url(&scope_refs);

    println!("\n[2/3] Authorization URL generated. Open in browser:");
    println!("  {}\n", auth_url);
    println!("After login, copy the 'code' query param from the redirect URL.");
    println!("Then run: oidc_consumer --code <code> ...");

    println!("\nCSRF token (verify matches redirect): {}", csrf.secret());

    Ok(())
}
