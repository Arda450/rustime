//! Normalisiert Windows-Fenstertitel zu lesbaren Kontext-Labels (Port der TS-Logik).

const BROWSER_SUFFIXES: &[&str] = &[
    " — Mozilla Firefox",
    " - Mozilla Firefox",
    " — Google Chrome",
    " - Google Chrome",
    " — Microsoft Edge",
    " - Microsoft Edge",
    " — Brave",
    " - Brave",
    " — Opera",
    " - Opera",
    " — Vivaldi",
    " - Vivaldi",
];

const KNOWN_APPS: &[&str] = &[
    "GitHub", "GitLab", "Jira", "Notion", "YouTube", "Figma", "Linear", "Discord", "Slack",
    "Trello",
];

fn strip_browser_suffix(title: &str) -> String {
    let mut out = title.trim().to_string();
    loop {
        let mut stripped = false;
        for suffix in BROWSER_SUFFIXES {
            if out.ends_with(suffix) {
                out = out[..out.len() - suffix.len()].trim().to_string();
                stripped = true;
            }
        }
        if !stripped {
            break;
        }
    }
    out
}

fn split_tokens(title: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let chars: Vec<char> = title.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if i + 2 < chars.len() {
            let triple: String = chars[i..i + 3].iter().collect();
            if triple == " · " || triple == " | " || triple == " — " || triple == " - " {
                if !current.trim().is_empty() {
                    tokens.push(current.trim().to_string());
                }
                current.clear();
                i += 3;
                continue;
            }
        }
        current.push(chars[i]);
        i += 1;
    }
    if !current.trim().is_empty() {
        tokens.push(current.trim().to_string());
    }
    tokens
}

fn is_repo_like(token: &str) -> bool {
    let parts: Vec<&str> = token.split('/').collect();
    parts.len() == 2
        && !parts[0].is_empty()
        && !parts[1].is_empty()
        && parts[0]
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
        && parts[1]
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
}

fn is_ticket_like(token: &str) -> bool {
    let Some((prefix, num)) = token.split_once('-') else {
        return false;
    };
    !prefix.is_empty()
        && prefix
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_uppercase())
        && prefix
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
        && !num.is_empty()
        && num.chars().all(|c| c.is_ascii_digit())
}

fn detect_app(tokens: &[String]) -> String {
    for t in tokens {
        if KNOWN_APPS.contains(&t.as_str()) {
            return t.clone();
        }
    }
    tokens
        .last()
        .cloned()
        .unwrap_or_else(|| "Unknown".to_string())
}

/// Kurzes Anzeige-Label für einen Roh-Fenstertitel.
pub fn format_context_label_from_title(raw_title: &str) -> String {
    let raw = raw_title.trim();
    if raw.is_empty() {
        return "Unknown".to_string();
    }

    let core = strip_browser_suffix(raw);
    let tokens = split_tokens(&core);
    if tokens.is_empty() {
        return "Unknown".to_string();
    }

    let app = detect_app(&tokens);
    let entity = tokens
        .iter()
        .find(|t| is_repo_like(t) || is_ticket_like(t))
        .cloned();

    let details: Vec<String> = tokens
        .iter()
        .filter(|t| **t != app && entity.as_ref() != Some(t))
        .cloned()
        .collect();

    if let Some(entity) = entity {
        return format!("{app}: {entity}");
    }
    if !details.is_empty() {
        return format!("{app}: {}", details.join(" | "));
    }
    app
}
