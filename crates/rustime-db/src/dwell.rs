use std::collections::HashMap;

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

/// Schätzt Verweildauer pro Kategorie aus aufsteigend sortierten Aktivitäten eines Projekts.
pub fn dwell_by_category(rows: &[ActivityWithProject], options: DwellOptions) -> Vec<DwellSegment> {
    if rows.is_empty() {
        return Vec::new();
    }

    let mut totals: HashMap<String, u64> = HashMap::new();

    if rows.len() == 1 {
        let cat = format_context_label_from_title(&rows[0].title);
        *totals.entry(cat).or_insert(0) += options.tail_seconds;
    } else {
        for i in 0..rows.len() - 1 {
            let raw_delta = rows[i + 1].timestamp.saturating_sub(rows[i].timestamp);
            let delta = raw_delta.min(options.max_segment_gap_seconds);
            let cat = format_context_label_from_title(&rows[i].title);
            *totals.entry(cat).or_insert(0) += delta;
        }
        let last = &rows[rows.len() - 1];
        let last_cat = format_context_label_from_title(&last.title);
        *totals.entry(last_cat).or_insert(0) += options.tail_seconds;
    }

    let mut segments: Vec<DwellSegment> = totals
        .into_iter()
        .filter(|(_, v)| *v > 0)
        .map(|(name, value_seconds)| DwellSegment {
            name,
            value_seconds,
        })
        .collect();

    segments.sort_by(|a, b| b.value_seconds.cmp(&a.value_seconds));

    if options.top_n > 0 && segments.len() > options.top_n {
        let rest_sum: u64 = segments[options.top_n..]
            .iter()
            .map(|s| s.value_seconds)
            .sum();
        segments.truncate(options.top_n);
        if rest_sum > 0 {
            segments.push(DwellSegment {
                name: "Sonstige".to_string(),
                value_seconds: rest_sum,
            });
        }
    }

    segments
}
