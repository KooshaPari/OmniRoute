//! `-v, --verbose` (count) and `-q, --quiet` (boolean) shared arg.

use clap::Args;

/// `-v, --verbose` and `-q, --quiet` flags, mutually exclusive.
///
/// Use as `#[command(flatten)] verbosity: Verbosity` on the top-level
/// CLI struct. The flags are grouped with `multiple = false`, so the
/// parser will reject `--verbose --quiet` combinations.
#[derive(Debug, Args, Clone, Copy, Default)]
#[group(multiple = false)]
pub struct Verbosity {
    /// Increase log verbosity (`-v`, `-vv`, `-vvv`).
    #[arg(short, long, action = clap::ArgAction::Count)]
    pub verbose: u8,

    /// Suppress non-error output.
    #[arg(short, long)]
    pub quiet: bool,
}

impl Verbosity {
    /// Convert the verbosity flags into a `tracing-subscriber` filter.
    ///
    /// - `--quiet`         → `ERROR`
    /// - (default)         → `INFO`
    /// - `-v`              → `DEBUG`
    /// - `-vv` (or more)   → `TRACE`
    pub fn to_filter(self) -> tracing_subscriber::filter::LevelFilter {
        match (self.verbose, self.quiet) {
            (_, true) => tracing_subscriber::filter::LevelFilter::ERROR,
            (0, false) => tracing_subscriber::filter::LevelFilter::INFO,
            (1, false) => tracing_subscriber::filter::LevelFilter::DEBUG,
            _ => tracing_subscriber::filter::LevelFilter::TRACE,
        }
    }

    /// Returns `true` if the quiet flag was set.
    pub fn is_quiet(self) -> bool {
        self.quiet
    }

    /// Returns the raw verbose count.
    pub fn verbose_count(self) -> u8 {
        self.verbose
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    #[derive(Debug, Parser)]
    struct Wrap {
        #[command(flatten)]
        v: Verbosity,
    }

    #[test]
    fn default_is_info() {
        let w = Wrap::parse_from(["test"]).v;
        assert_eq!(w.verbose_count(), 0);
        assert!(!w.is_quiet());
        assert!(matches!(
            w.to_filter(),
            tracing_subscriber::filter::LevelFilter::INFO
        ));
    }

    #[test]
    fn single_v_is_debug() {
        let w = Wrap::parse_from(["test", "-v"]).v;
        assert_eq!(w.verbose_count(), 1);
        assert!(matches!(
            w.to_filter(),
            tracing_subscriber::filter::LevelFilter::DEBUG
        ));
    }

    #[test]
    fn double_v_is_trace() {
        let w = Wrap::parse_from(["test", "-vv"]).v;
        assert_eq!(w.verbose_count(), 2);
        assert!(matches!(
            w.to_filter(),
            tracing_subscriber::filter::LevelFilter::TRACE
        ));
    }

    #[test]
    fn triple_v_is_still_trace() {
        let w = Wrap::parse_from(["test", "-vvv"]).v;
        assert_eq!(w.verbose_count(), 3);
        assert!(matches!(
            w.to_filter(),
            tracing_subscriber::filter::LevelFilter::TRACE
        ));
    }

    #[test]
    fn quiet_is_error() {
        let w = Wrap::parse_from(["test", "--quiet"]).v;
        assert!(w.is_quiet());
        assert!(matches!(
            w.to_filter(),
            tracing_subscriber::filter::LevelFilter::ERROR
        ));
    }

    #[test]
    fn short_quiet_is_error() {
        let w = Wrap::parse_from(["test", "-q"]).v;
        assert!(w.is_quiet());
    }

    #[test]
    fn long_verbose_works() {
        let w = Wrap::parse_from(["test", "--verbose", "--verbose"]).v;
        assert_eq!(w.verbose_count(), 2);
    }
}
