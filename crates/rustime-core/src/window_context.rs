//! Normalisiert Windows-Fenstertitel zu lesbaren Kontext-Labels und klassifiziert Tätigkeitstypen.

/// Tätigkeitsklassen für die Übersichts-Aggregation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ActivityType {
    Development,
    Communication,
    Research,
    Organization,
    Other,
}

impl ActivityType {
    /// Deutscher Anzeigename für UI und Export.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Development => "Entwicklung",
            Self::Communication => "Kommunikation",
            Self::Research => "Recherche",
            Self::Organization => "Organisation",
            Self::Other => "Sonstiges",
        }
    }

    /// Alle Varianten in fester Reihenfolge (für konsistente Charts).
    pub fn all() -> &'static [ActivityType] {
        &[
            Self::Development,
            Self::Communication,
            Self::Research,
            Self::Organization,
            Self::Other,
        ]
    }
}

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

/// Bekannte Desktop-Apps und Browser: Muster (lowercase) → kanonischer Anzeigename.
const CANONICAL_APP_NAMES: &[(&str, &str)] = &[
    ("visual studio code", "Visual Studio Code"),
    ("mozilla firefox", "Mozilla Firefox"),
    ("google chrome", "Google Chrome"),
    ("microsoft edge", "Microsoft Edge"),
    ("windows terminal", "Windows Terminal"),
    ("command prompt", "Command Prompt"),
    ("spotify", "Spotify"),
    ("cursor", "Cursor"),
    ("discord", "Discord"),
    ("slack", "Slack"),
    ("notion", "Notion"),
    ("figma", "Figma"),
];

fn detect_app(core_title: &str, tokens: &[String]) -> String {
    for t in tokens {
        if KNOWN_APPS.contains(&t.as_str()) {
            return t.clone();
        }
        for known in KNOWN_APPS {
            if t.contains(known) {
                return (*known).to_string();
            }
        }
    }

    let lower = core_title.to_lowercase();
    for (pattern, name) in CANONICAL_APP_NAMES {
        if lower.contains(pattern) {
            return (*name).to_string();
        }
    }

    tokens
        .last()
        .cloned()
        .unwrap_or_else(|| "Unknown".to_string())
}

/// Nur App-/Programmname für Pie-Charts und Kategorie-Aggregation (ohne Datei/Fensterdetails).
pub fn format_app_label_from_title(raw_title: &str) -> String {
    let raw = raw_title.trim();
    if raw.is_empty() {
        return "Unknown".to_string();
    }

    let core = strip_browser_suffix(raw);
    let tokens = split_tokens(&core);
    if tokens.is_empty() {
        return "Unknown".to_string();
    }

    detect_app(&core, &tokens)
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

    let app = detect_app(&core, &tokens);
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

/// Klassifiziert einen Fenstertitel in eine Tätigkeitsklasse.
///
/// Nutzt Regeln basierend auf App-Name und URL-Patterns. Reihenfolge:
/// 1. IDE/Terminal/Git → Entwicklung
/// 2. Kommunikations-Apps → Kommunikation
/// 3. Docs/StackOverflow/technische Sites → Recherche
/// 4. Explorer/Kalender/Planung → Organisation
/// 5. Fallback → Sonstiges
pub fn classify_activity_type(raw_title: &str) -> ActivityType {
    let lower = raw_title.to_lowercase();

    // Entwicklung: IDEs, Terminals, Git-Tools, Code-Hosting im Browser
    if is_development(&lower) {
        return ActivityType::Development;
    }

    // Kommunikation: Chat, Mail, Meetings
    if is_communication(&lower) {
        return ActivityType::Communication;
    }

    // Recherche: Docs, StackOverflow, technische Artikel
    if is_research(&lower) {
        return ActivityType::Research;
    }

    // Organisation: Explorer, Kalender, Notion (Planung), PDF
    if is_organization(&lower) {
        return ActivityType::Organization;
    }

    ActivityType::Other
}

fn is_development(lower: &str) -> bool {
    // IDEs und Editoren
    let ide_patterns = [
        "visual studio code",
        "vs code",
        "cursor",
        "rustrover",
        "intellij",
        "pycharm",
        "webstorm",
        "rider",
        "clion",
        "goland",
        "android studio",
        "xcode",
        "sublime text",
        "atom",
        "vim",
        "neovim",
        "emacs",
        "notepad++",
    ];
    for p in ide_patterns {
        if lower.contains(p) {
            return true;
        }
    }

    // Terminals
    let terminal_patterns = [
        "windows terminal",
        "powershell",
        "command prompt",
        "cmd.exe",
        "terminal",
        "iterm",
        "warp",
        "hyper",
        "alacritty",
        "kitty",
        "wezterm",
    ];
    for p in terminal_patterns {
        if lower.contains(p) {
            return true;
        }
    }

    // Git-Tools
    let git_patterns = [
        "github desktop",
        "gitkraken",
        "sourcetree",
        "fork",
        "tower",
        "lazygit",
    ];
    for p in git_patterns {
        if lower.contains(p) {
            return true;
        }
    }

    // Browser mit Code-Hosting oder CI/CD
    let dev_browser_patterns = [
        "github.com",
        "gitlab.com",
        "bitbucket.org",
        "codeberg.org",
        "pull request",
        "merge request",
        "actions",
        "ci/cd",
        "jenkins",
        "circleci",
        "travis",
        "vercel",
        "netlify",
        "railway",
        "render.com",
        "localhost",
        "127.0.0.1",
        "codepen",
        "codesandbox",
        "replit",
        "jsfiddle",
        "crates.io",
        "npmjs.com",
        "pypi.org",
        "pkg.go.dev",
        "docs.rs",
    ];
    for p in dev_browser_patterns {
        if lower.contains(p) {
            return true;
        }
    }

    false
}

fn is_communication(lower: &str) -> bool {
    let patterns = [
        "slack",
        "discord",
        "teams",
        "microsoft teams",
        "zoom",
        "google meet",
        "webex",
        "skype",
        "telegram",
        "whatsapp",
        "signal",
        "element",
        "matrix",
        "outlook",
        "thunderbird",
        "mail",
        "gmail",
        "protonmail",
        "hey.com",
        "fastmail",
        "calendar",
        "meetings",
        "huddle",
        "loom",
        "whereby",
    ];
    for p in patterns {
        if lower.contains(p) {
            return true;
        }
    }
    false
}

fn is_research(lower: &str) -> bool {
    let patterns = [
        "stackoverflow",
        "stack overflow",
        "stackexchange",
        "reddit.com/r/programming",
        "reddit.com/r/rust",
        "reddit.com/r/webdev",
        "reddit.com/r/javascript",
        "reddit.com/r/reactjs",
        "hacker news",
        "news.ycombinator",
        "dev.to",
        "medium.com",
        "hashnode",
        "freecodecamp",
        "w3schools",
        "mdn web docs",
        "developer.mozilla",
        "learn.microsoft",
        "docs.microsoft",
        "docs.google",
        "documentation",
        "api reference",
        "tutorial",
        "guide",
        "handbook",
        "manual",
        "specification",
        "rfc",
        "wikipedia",
        "arxiv",
        "researchgate",
        "scholar.google",
        "tauri.app",
        "react.dev",
        "typescriptlang.org",
        "rust-lang.org",
        "doc.rust-lang",
    ];
    for p in patterns {
        if lower.contains(p) {
            return true;
        }
    }
    false
}

fn is_organization(lower: &str) -> bool {
    let patterns = [
        "explorer",
        "finder",
        "files",
        "datei-explorer",
        "notion",
        "obsidian",
        "roam",
        "logseq",
        "evernote",
        "onenote",
        "bear",
        "trello",
        "asana",
        "monday.com",
        "clickup",
        "todoist",
        "linear",
        "jira",
        "confluence",
        "figma",
        "miro",
        "lucidchart",
        "draw.io",
        "excalidraw",
        "pdf",
        "acrobat",
        "preview",
        "word",
        "docs",
        "google docs",
        "sheets",
        "excel",
        "powerpoint",
        "slides",
        "keynote",
        "numbers",
        "pages",
    ];
    for p in patterns {
        if lower.contains(p) {
            return true;
        }
    }
    false
}
