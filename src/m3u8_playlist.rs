// Minimal HLS M3U8 playlist parser/writer (RFC 8216 subset).
//
// Supports the most common tags used in a live or VOD HLS playlist:
//   #EXTM3U                 - mandatory header (otherwise it is just an M3U)
//   #EXT-X-VERSION:N        - protocol version
//   #EXT-X-TARGETDURATION:N - max segment duration (rounded up)
//   #EXT-X-MEDIA-SEQUENCE:N - first segment's sequence number
//   #EXTINF:<duration>,<title> - per-segment info (duration is required, title is optional)
//   #EXT-X-ENDLIST          - signals end of playlist (VOD or live termination)
//
// Anything we don't recognize is ignored when reading.

#[derive(Debug, Clone, PartialEq)]
pub struct Segment {
    pub duration: f64,
    pub title: String,
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Playlist {
    pub version: u8,
    pub target_duration: u32,
    pub media_sequence: u32,
    pub is_endlist: bool,
    pub segments: Vec<Segment>,
}

impl Playlist {
    pub fn new() -> Self {
        Playlist {
            version: 0,
            target_duration: 0,
            media_sequence: 0,
            is_endlist: false,
            segments: Vec::new(),
        }
    }
}

impl Default for Playlist {
    fn default() -> Self {
        Playlist::new()
    }
}

/// Parse an M3U8 playlist body. The body must begin with `#EXTM3U`; otherwise
/// we still attempt to parse (some tools omit it), but we require
/// `#EXT-X-VERSION` or one of the segment tags to consider it parseable.
pub fn parse(input: &str) -> Result<Playlist, String> {
    let mut pl = Playlist::new();
    let mut saw_extm3u = false;
    let mut pending_duration: Option<f64> = None;
    let mut pending_title: String = String::new();

    for (idx, raw_line) in input.lines().enumerate() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        if line == "#EXTM3U" {
            saw_extm3u = true;
            continue;
        }
        if !line.starts_with('#') {
            // URI line. It pairs with a previously seen #EXTINF if any.
            if let Some(dur) = pending_duration.take() {
                pl.segments.push(Segment {
                    duration: dur,
                    title: std::mem::take(&mut pending_title),
                    uri: line.to_string(),
                });
            } else {
                // Bare URI without #EXTINF — treat as a segment with no duration
                // info. Use 0.0 and empty title so callers can still see it.
                pl.segments.push(Segment {
                    duration: 0.0,
                    title: String::new(),
                    uri: line.to_string(),
                });
            }
            continue;
        }
        // Tag line.
        if let Some(rest) = line.strip_prefix("#EXT-X-VERSION:") {
            let v: u32 = rest
                .trim()
                .parse()
                .map_err(|e| format!("line {}: bad version {:?}: {}", idx + 1, rest, e))?;
            if v > u8::MAX as u32 {
                return Err(format!("line {}: version {} out of range", idx + 1, v));
            }
            pl.version = v as u8;
        } else if let Some(rest) = line.strip_prefix("#EXT-X-TARGETDURATION:") {
            pl.target_duration = rest
                .trim()
                .parse()
                .map_err(|e| format!("line {}: bad TARGETDURATION: {}", idx + 1, e))?;
        } else if let Some(rest) = line.strip_prefix("#EXT-X-MEDIA-SEQUENCE:") {
            pl.media_sequence = rest
                .trim()
                .parse()
                .map_err(|e| format!("line {}: bad MEDIA-SEQUENCE: {}", idx + 1, e))?;
        } else if line == "#EXT-X-ENDLIST" {
            pl.is_endlist = true;
        } else if let Some(rest) = line.strip_prefix("#EXTINF:") {
            // #EXTINF:<duration>,<title>
            let (dur_str, title) = match rest.find(',') {
                Some(c) => (&rest[..c], rest[c + 1..].to_string()),
                None => (rest, String::new()),
            };
            let dur: f64 = dur_str
                .trim()
                .parse()
                .map_err(|e| format!("line {}: bad EXTINF duration {:?}: {}", idx + 1, dur_str, e))?;
            if !dur.is_finite() || dur < 0.0 {
                return Err(format!(
                    "line {}: EXTINF duration must be finite and non-negative",
                    idx + 1
                ));
            }
            pending_duration = Some(dur);
            pending_title = title;
        }
        // All other tags (#EXT-X-STREAM-INF, #EXT-X-DISCONTINUITY, etc.)
        // are intentionally ignored.
    }

    if !saw_extm3u && pl.segments.is_empty() && pl.version == 0 {
        return Err("input is not a recognizable M3U8 playlist".to_string());
    }
    Ok(pl)
}

/// Serialize a Playlist back to M3U8 text.
pub fn write(p: &Playlist) -> String {
    let mut s = String::new();
    s.push_str("#EXTM3U\n");
    if p.version != 0 {
        s.push_str(&format!("#EXT-X-VERSION:{}\n", p.version));
    }
    if p.target_duration != 0 {
        s.push_str(&format!("#EXT-X-TARGETDURATION:{}\n", p.target_duration));
    }
    if p.media_sequence != 0 {
        s.push_str(&format!("#EXT-X-MEDIA-SEQUENCE:{}\n", p.media_sequence));
    }
    for seg in &p.segments {
        if seg.title.is_empty() {
            s.push_str(&format!("#EXTINF:{},\n", format_duration(seg.duration)));
        } else {
            s.push_str(&format!("#EXTINF:{},{}\n", format_duration(seg.duration), seg.title));
        }
        s.push_str(&seg.uri);
        s.push('\n');
    }
    if p.is_endlist {
        s.push_str("#EXT-X-ENDLIST\n");
    }
    s
}

/// Format a float duration the way HLS writers typically do: trim trailing zeros
/// while keeping at least one digit after the decimal point if any.
fn format_duration(d: f64) -> String {
    if !d.is_finite() {
        return "0.000".to_string();
    }
    // Format with up to 3 decimals, then strip trailing zeros and a trailing dot.
    let s = format!("{:.3}", d);
    let trimmed = s.trim_end_matches('0').trim_end_matches('.');
    if trimmed.is_empty() || trimmed == "-" {
        "0".to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_minimal_playlist() {
        let input = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:9.5,\nseg0.ts\n#EXTINF:10.0,\nseg1.ts\n#EXT-X-ENDLIST\n";
        let pl = parse(input).unwrap();
        assert_eq!(pl.version, 3);
        assert_eq!(pl.target_duration, 10);
        assert_eq!(pl.media_sequence, 0);
        assert!(pl.is_endlist);
        assert_eq!(pl.segments.len(), 2);
        assert_eq!(pl.segments[0].duration, 9.5);
        assert_eq!(pl.segments[0].uri, "seg0.ts");
        assert_eq!(pl.segments[1].duration, 10.0);
        assert_eq!(pl.segments[1].uri, "seg1.ts");
    }

    #[test]
    fn parse_segment_with_title() {
        let input = "#EXTM3U\n#EXTINF:5.250,Opening Credits\nintro.ts\n";
        let pl = parse(input).unwrap();
        assert_eq!(pl.segments.len(), 1);
        assert_eq!(pl.segments[0].duration, 5.25);
        assert_eq!(pl.segments[0].title, "Opening Credits");
        assert_eq!(pl.segments[0].uri, "intro.ts");
    }

    #[test]
    fn parse_live_no_endlist() {
        let input = "#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:42\n#EXTINF:4.0,\nseg-0042.ts\n#EXTINF:3.5,\nseg-0043.ts\n";
        let pl = parse(input).unwrap();
        assert_eq!(pl.version, 6);
        assert_eq!(pl.media_sequence, 42);
        assert!(!pl.is_endlist);
        assert_eq!(pl.segments.len(), 2);
        assert_eq!(pl.segments[1].duration, 3.5);
    }

    #[test]
    fn parse_ignores_unknown_tags() {
        let input = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-DISCONTINUITY\n#EXTINF:2.0,\na.ts\n#EXT-X-PROGRAM-DATE-TIME:2026-07-06T00:00:00Z\nb.ts\n";
        let pl = parse(input).unwrap();
        assert_eq!(pl.segments.len(), 2);
        assert_eq!(pl.segments[1].uri, "b.ts");
    }

    #[test]
    fn parse_bare_uri_without_extinf() {
        // Some playlists have just URIs. We should still produce segments.
        let input = "#EXTM3U\na.ts\nb.ts\n";
        let pl = parse(input).unwrap();
        assert_eq!(pl.segments.len(), 2);
        assert_eq!(pl.segments[0].uri, "a.ts");
        assert_eq!(pl.segments[0].duration, 0.0);
        assert_eq!(pl.segments[1].uri, "b.ts");
    }

    #[test]
    fn parse_bad_version_errors() {
        let input = "#EXTM3U\n#EXT-X-VERSION:notanumber\n";
        assert!(parse(input).is_err());
    }

    #[test]
    fn parse_bad_extinf_errors() {
        let input = "#EXTM3U\n#EXTINF:notanumber,\nfoo.ts\n";
        assert!(parse(input).is_err());
    }

    #[test]
    fn parse_negative_extinf_errors() {
        let input = "#EXTM3U\n#EXTINF:-1.0,\nfoo.ts\n";
        assert!(parse(input).is_err());
    }

    #[test]
    fn write_round_trip() {
        let original = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:7\n#EXTINF:5.5,Title A\na.ts\n#EXTINF:7.25,\nb.ts\n#EXT-X-ENDLIST\n";
        let pl = parse(original).unwrap();
        let out = write(&pl);
        // Re-parse to ensure equivalence.
        let pl2 = parse(&out).unwrap();
        assert_eq!(pl, pl2);
        assert!(out.contains("#EXT-X-VERSION:3"));
        assert!(out.contains("#EXT-X-TARGETDURATION:10"));
        assert!(out.contains("#EXT-X-MEDIA-SEQUENCE:7"));
        assert!(out.contains("#EXT-X-ENDLIST"));
    }

    #[test]
    fn write_empty_playlist_is_valid_header() {
        let pl = Playlist::new();
        let out = write(&pl);
        assert!(out.starts_with("#EXTM3U\n"));
        assert!(!out.contains("#EXT-X-VERSION:"));
        assert!(!out.contains("#EXT-X-ENDLIST"));
    }

    #[test]
    fn write_skips_zero_media_sequence() {
        let mut pl = Playlist::new();
        pl.media_sequence = 0;
        let out = write(&pl);
        assert!(!out.contains("#EXT-X-MEDIA-SEQUENCE:"));
    }

    #[test]
    fn parse_extra_whitespace_is_tolerated() {
        let input = "#EXTM3U\n  #EXT-X-VERSION:3  \n#EXTINF: 6.0 , hello  \nclip.ts\n";
        let pl = parse(input).unwrap();
        assert_eq!(pl.version, 3);
        assert_eq!(pl.segments[0].duration, 6.0);
        assert_eq!(pl.segments[0].uri, "clip.ts");
    }
}