export type ContextConfidence = "high" | "medium" | "low";

export type ParsedWindowContext = {
  app: string;
  entity?: string;
  details?: string;
  raw: string;
  confidence: ContextConfidence;
};

const BROWSER_SUFFIXES: RegExp[] = [
  /\s+[—-]\s+Mozilla Firefox$/i,
  /\s+[—-]\s+Google Chrome$/i,
  /\s+[—-]\s+Microsoft Edge$/i,
  /\s+[—-]\s+Brave$/i,
  /\s+[—-]\s+Opera$/i,
  /\s+[—-]\s+Vivaldi$/i,
];

const KNOWN_APPS = [
  "GitHub",
  "GitLab",
  "Jira",
  "Notion",
  "YouTube",
  "Figma",
  "Linear",
  "Discord",
  "Slack",
  "Trello",
];

function stripBrowserSuffix(title: string): string {
  let out = title.trim();
  for (const re of BROWSER_SUFFIXES) {
    out = out.replace(re, "").trim();
  }
  return out;
}

function splitTokens(title: string): string[] {
  return title
    .split(/\s+[·|—-]\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function findRepoLikeToken(tokens: string[]): string | undefined {
  return tokens.find((t) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(t));
}

function findTicketLikeToken(tokens: string[]): string | undefined {
  return tokens.find((t) => /^[A-Z][A-Z0-9]+-\d+$/.test(t));
}

function detectApp(tokens: string[]): string {
  const known = tokens.find((t) => KNOWN_APPS.includes(t));
  if (known) return known;
  if (tokens.length > 0) return tokens[tokens.length - 1];
  return "Unknown";
}

export function parseWindowContext(rawTitle: string): ParsedWindowContext {
  const raw = rawTitle.trim();

  if (!raw) {
    return {
      app: "Unknown",
      raw,
      confidence: "low",
    };
  }

  const core = stripBrowserSuffix(raw);
  const tokens = splitTokens(core);

  const app = detectApp(tokens);
  const entity = findRepoLikeToken(tokens) ?? findTicketLikeToken(tokens);

  const detailsParts = tokens.filter((t) => t !== app && t !== entity);
  const details =
    detailsParts.length > 0 ? detailsParts.join(" | ") : undefined;

  return {
    app,
    entity,
    details,
    raw,
    confidence: entity ? "high" : "medium",
  };
}

export function formatContextLabel(ctx: ParsedWindowContext): string {
  if (ctx.entity) return `${ctx.app}: ${ctx.entity}`;
  if (ctx.details) return `${ctx.app}: ${ctx.details}`;
  return ctx.app;
}
