use std::collections::{BTreeMap, HashMap};

use rustime_core::window_context::format_context_label_from_title;

use crate::activity_repo::ActivityWithProject;

#[derive(Debug, Clone)]
pub struct DwellSegment {
    pub name: String,
    pub value_seconds: u64,
}

pub struct DwellOptions {
    pub max_segment_gap_seconds: u64,
    pub tail_seconds: u64,
    pub top_n: usize,
}

impl Default for DwellOptions {
    fn default() -> Self {
        Self {
            max_segment_gap_seconds: 120,
            tail_seconds: 2,
            top_n: 10,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct TimeSeriesOptions {
    pub from_ts: u64,
    pub to_ts: u64,
    pub bucket_seconds: u64,
    pub max_segment_gap_seconds: u64,
    pub tail_seconds: u64,
    /// Wenn true: X-Achse beginnt exakt bei `from_ts` (z. B. Mitternacht im Tagesbericht).
    pub align_to_range_start: bool,
}

impl Default for TimeSeriesOptions {
    fn default() -> Self {
        Self {
            from_ts: 0,
            to_ts: 0,
            bucket_seconds: 900,
            max_segment_gap_seconds: 120,
            tail_seconds: 2,
            align_to_range_start: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CategoryTimeSeriesPoint {
    pub bucket_start_ts: u64,
    pub by_category: Vec<(String, u64)>,
}

#[derive(Debug, Clone)]
struct Segment {
    start_ts: u64,
    end_ts: u64, // exklusiv
    category: String,
}

/// Schätzt Verweildauer pro Kategorie aus aufsteigend sortierten Aktivitäten eines Projekts.
pub fn dwell_by_category(rows: &[ActivityWithProject], options: DwellOptions) -> Vec<DwellSegment> {
    if rows.is_empty() {
        return Vec::new();
    }

    let mut totals: HashMap<String, u64> = HashMap::new();

    for seg in build_segments(rows, options.max_segment_gap_seconds, options.tail_seconds) {
        let secs = seg.end_ts.saturating_sub(seg.start_ts);
        if secs > 0 {
            *totals.entry(seg.category).or_insert(0) += secs;
        }
    }

    finalize_dwell_segments(totals, options.top_n)
}

/// Wie `dwell_by_category`, aber Segmente werden auf `[from_ts, to_ts]` beschnitten.
pub fn dwell_by_category_in_range(
    rows: &[ActivityWithProject],
    options: DwellOptions,
    from_ts: u64,
    to_ts: u64,
) -> Vec<DwellSegment> {
    if rows.is_empty() || to_ts <= from_ts {
        return Vec::new();
    }

    let mut totals: HashMap<String, u64> = HashMap::new();

    for seg in build_segments(rows, options.max_segment_gap_seconds, options.tail_seconds) {
        let clip_start = seg.start_ts.max(from_ts);
        let clip_end = seg.end_ts.min(to_ts);
        if clip_end > clip_start {
            *totals.entry(seg.category).or_insert(0) += clip_end - clip_start;
        }
    }

    finalize_dwell_segments(totals, options.top_n)
}

/// Wie `dwell_by_category_in_range`, aber nach Roh-Fenstertitel statt Kategorie.
pub fn dwell_by_title_in_range(
    rows: &[ActivityWithProject],
    options: DwellOptions,
    from_ts: u64,
    to_ts: u64,
) -> Vec<DwellSegment> {
    if rows.is_empty() || to_ts <= from_ts {
        return Vec::new();
    }

    let mut totals: HashMap<String, u64> = HashMap::new();

    for seg in build_title_segments(rows, options.max_segment_gap_seconds, options.tail_seconds) {
        let clip_start = seg.start_ts.max(from_ts);
        let clip_end = seg.end_ts.min(to_ts);
        if clip_end > clip_start {
            *totals.entry(seg.title).or_insert(0) += clip_end - clip_start;
        }
    }

    finalize_dwell_segments(totals, options.top_n)
}

fn build_title_segments(
    rows: &[ActivityWithProject],
    max_segment_gap_seconds: u64,
    tail_seconds: u64,
) -> Vec<TitleSegment> {
    if rows.is_empty() {
        return Vec::new();
    }

    let mut out = Vec::with_capacity(rows.len());

    if rows.len() == 1 {
        out.push(TitleSegment {
            start_ts: rows[0].timestamp,
            end_ts: rows[0].timestamp.saturating_add(tail_seconds),
            title: rows[0].title.clone(),
        });
        return out;
    }

    for i in 0..rows.len() - 1 {
        let start = rows[i].timestamp;
        let raw_delta = rows[i + 1].timestamp.saturating_sub(start);
        let delta = raw_delta.min(max_segment_gap_seconds);
        let end = start.saturating_add(delta);

        out.push(TitleSegment {
            start_ts: start,
            end_ts: end,
            title: rows[i].title.clone(),
        });
    }

    let last = &rows[rows.len() - 1];
    out.push(TitleSegment {
        start_ts: last.timestamp,
        end_ts: last.timestamp.saturating_add(tail_seconds),
        title: last.title.clone(),
    });

    out
}

#[derive(Debug, Clone)]
struct TitleSegment {
    start_ts: u64,
    end_ts: u64,
    title: String,
}

fn finalize_dwell_segments(
    totals: HashMap<String, u64>,
    top_n: usize,
) -> Vec<DwellSegment> {
    let mut segments: Vec<DwellSegment> = totals
        .into_iter()
        .filter(|(_, v)| *v > 0)
        .map(|(name, value_seconds)| DwellSegment {
            name,
            value_seconds,
        })
        .collect();

    segments.sort_by(|a, b| b.value_seconds.cmp(&a.value_seconds));

    if top_n > 0 && segments.len() > top_n {
        let rest_sum: u64 = segments[top_n..]
            .iter()
            .map(|s| s.value_seconds)
            .sum();
        segments.truncate(top_n);
        if rest_sum > 0 {
            segments.push(DwellSegment {
                name: "Sonstige".to_string(),
                value_seconds: rest_sum,
            });
        }
    }

    segments
}

/// Zeitverlauf pro Kategorie über Buckets (für stacked Charts).
/// Erwartet aufsteigend sortierte Aktivitäten.
pub fn dwell_time_series_by_category(
    rows: &[ActivityWithProject],
    options: TimeSeriesOptions,
) -> Vec<CategoryTimeSeriesPoint> {
    if !is_valid_timeseries_options(options) {
        return Vec::new();
    }

    let from_ts = effective_from_ts(options, rows);
    let bucket_starts: Vec<u64> =
        prefill_buckets(from_ts, options.to_ts, options.bucket_seconds)
            .into_keys()
            .collect();

    let mut buckets: BTreeMap<u64, HashMap<String, u64>> = bucket_starts
        .into_iter()
        .map(|ts| (ts, HashMap::new()))
        .collect();

    for seg in build_segments(rows, options.max_segment_gap_seconds, options.tail_seconds) {
        add_segment_to_category_buckets(&mut buckets, &seg, options);
    }

    buckets
        .into_iter()
        .map(|(bucket_start_ts, categories)| {
            let mut by_category: Vec<(String, u64)> = categories.into_iter().collect();
            by_category.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));

            CategoryTimeSeriesPoint {
                bucket_start_ts,
                by_category,
            }
        })
        .collect()
}

/// Linker Rand des Charts: ab erstem Aktivitäts-Bucket, aber nicht vor `from_ts` (Maximal-Fenster).
fn effective_from_ts(options: TimeSeriesOptions, rows: &[ActivityWithProject]) -> u64 {
    if options.align_to_range_start {
        return options.from_ts;
    }
    if rows.is_empty() {
        return options.from_ts;
    }
    let first_bucket =
        (rows[0].timestamp / options.bucket_seconds) * options.bucket_seconds;
    first_bucket.max(options.from_ts)
}

fn is_valid_timeseries_options(options: TimeSeriesOptions) -> bool {
    options.to_ts > options.from_ts
        && options.bucket_seconds > 0
        && options.max_segment_gap_seconds > 0
}

fn build_segments(
    rows: &[ActivityWithProject],
    max_segment_gap_seconds: u64,
    tail_seconds: u64,
) -> Vec<Segment> {
    if rows.is_empty() {
        return Vec::new();
    }

    let mut out = Vec::with_capacity(rows.len());

    if rows.len() == 1 {
        let cat = format_context_label_from_title(&rows[0].title);
        out.push(Segment {
            start_ts: rows[0].timestamp,
            end_ts: rows[0].timestamp.saturating_add(tail_seconds),
            category: cat,
        });
        return out;
    }

    for i in 0..rows.len() - 1 {
        let start = rows[i].timestamp;
        let raw_delta = rows[i + 1].timestamp.saturating_sub(start);
        let delta = raw_delta.min(max_segment_gap_seconds);
        let end = start.saturating_add(delta);

        out.push(Segment {
            start_ts: start,
            end_ts: end,
            category: format_context_label_from_title(&rows[i].title),
        });
    }

    let last = &rows[rows.len() - 1];
    out.push(Segment {
        start_ts: last.timestamp,
        end_ts: last.timestamp.saturating_add(tail_seconds),
        category: format_context_label_from_title(&last.title),
    });

    out
}

fn prefill_buckets(from_ts: u64, to_ts: u64, bucket_seconds: u64) -> BTreeMap<u64, u64> {
    let mut out = BTreeMap::new();
    if to_ts <= from_ts || bucket_seconds == 0 {
        return out;
    }

    let first = (from_ts / bucket_seconds) * bucket_seconds;
    let mut cur = first;
    while cur < to_ts {
        out.insert(cur, 0);
        cur = cur.saturating_add(bucket_seconds);
    }

    out
}

fn add_segment_to_category_buckets(
    buckets: &mut BTreeMap<u64, HashMap<String, u64>>,
    seg: &Segment,
    options: TimeSeriesOptions,
) {
    add_clipped_range_to_category_buckets(
        buckets,
        &seg.category,
        seg.start_ts,
        seg.end_ts,
        options.from_ts,
        options.to_ts,
        options.bucket_seconds,
    );
}

fn add_clipped_range_to_category_buckets(
    buckets: &mut BTreeMap<u64, HashMap<String, u64>>,
    category: &str,
    start_ts: u64,
    end_ts: u64,
    from_ts: u64,
    to_ts: u64,
    bucket_seconds: u64,
) {
    if end_ts <= start_ts || to_ts <= from_ts || bucket_seconds == 0 {
        return;
    }

    let clip_start = start_ts.max(from_ts);
    let clip_end = end_ts.min(to_ts);
    if clip_end <= clip_start {
        return;
    }

    add_range_to_buckets(clip_start, clip_end, bucket_seconds, |bucket_start, secs| {
        let map = buckets.entry(bucket_start).or_default();
        *map.entry(category.to_string()).or_insert(0) += secs;
    });
}

fn add_range_to_buckets<F>(start_ts: u64, end_ts: u64, bucket_seconds: u64, mut add: F)
where
    F: FnMut(u64, u64),
{
    let mut cur = start_ts;

    while cur < end_ts {
        let bucket_start = (cur / bucket_seconds) * bucket_seconds;
        let bucket_end = bucket_start.saturating_add(bucket_seconds);
        let chunk_end = end_ts.min(bucket_end);
        let secs = chunk_end.saturating_sub(cur);

        if secs > 0 {
            add(bucket_start, secs);
        }

        cur = chunk_end;
    }
}
