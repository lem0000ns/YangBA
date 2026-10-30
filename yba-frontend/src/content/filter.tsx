/** One profile fact row (optional secondary line). */
export interface FactLine {
  primary: string;
  secondary?: string;
}

/** Parsed award line from Wikipedia infobox text. */
export interface Award {
  name: string;
  years?: string;
}

/** One stop on a player's career timeline. */
export interface TeamStint {
  year: string;
  team: string;
  affiliate: boolean;
  current: boolean;
}

/** Normalize whitespace and strip citation markers from scraped text. */
const tidy = (value: string) =>
  value
    .replace(/\u00a0/g, " ")
    .replace(/\[\w+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Fix common unicode escape artifacts in stored profile strings. */
const cleanUnicode = (value: string) =>
  tidy(value).replace(/u2013/g, "\u2013").replace(/u2192/g, "\u2192");

/** Return trimmed text or empty when missing / "none". */
const blank = (value: string | null | undefined) => {
  if (!value) return "";
  const text = tidy(value);
  return !text || text.toLowerCase() == "none" ? "" : text;
};

/** Split "Primary (secondary)" into a FactLine. */
const splitParen = (line: string): FactLine => {
  const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!match) return { primary: line };
  return { primary: match[1].trim(), secondary: match[2].trim() };
};

/** Parse born/age line from player profile into fact rows. */
export const parseBorn = (value: string | null | undefined): FactLine[] => {
  const text = blank(value);
  if (!text) return [];
  const match = text.match(/^(?:\(\d{4}-\d{2}-\d{2}\)\s*)?(.+?)\s*\(age[^)]*\)\s*(.*)$/);
  if (!match) return [splitParen(text)];
  const place = match[2].trim();
  return [{ primary: match[1].trim(), secondary: place || undefined }];
};

/** Parse height/weight strings with optional metric in parentheses. */
export const parseMeasure = (value: string | null | undefined): FactLine[] => {
  const text = blank(value);
  return text ? [splitParen(text)] : [];
};

/** Parse NBA draft or undrafted line into fact rows. */
export const parseDraft = (value: string | null | undefined): FactLine[] => {
  const text = blank(value);
  if (!text) return [];
  const pick = text.match(/^(\d{4}):\s*(\d+\w*)\s+round,\s*(\d+\w*)\s+overall(?:\s+pick)?/i);
  if (pick) return [{ primary: `${pick[3]} overall`, secondary: `${pick[1]} · ${pick[2]} round` }];
  const undrafted = text.match(/^(\d{4}):\s*undrafted/i);
  if (undrafted) return [{ primary: "Undrafted", secondary: undrafted[1] }];
  return [{ primary: text }];
};

/** Wrap a single non-empty profile field as one fact row. */
export const parsePlain = (value: string | null | undefined): FactLine[] => {
  const text = blank(value);
  return text ? [{ primary: text }] : [];
};

/** Parse multiline school/location fields into fact rows. */
export const parsePlace = (value: string | null | undefined): FactLine[] => {
  if (!value) return [];
  return value
    .split("\n")
    .map(tidy)
    .filter((line) => line && line.toLowerCase() != "none")
    .map(splitParen);
};

/** Parse awards block text into structured award entries. */
export const parseAwards = (value: string | null | undefined): Award[] => {
  if (!value) return [];
  return value
    .split("\n")
    .map(tidy)
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      if (!match) return { name: line };
      const years = match[2].trim();
      return { name: match[1].trim(), years: years || undefined };
    })
    .filter((award) => award.name);
};

/** Parse career teams JSON into timeline stops. */
export const parseTeams = (teams: string | null | undefined): TeamStint[] => {
  if (!teams) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(teams);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item != "object") return [];
    const entry = Object.entries(item as Record<string, string>)[0];
    if (!entry) return [];
    const year = cleanUnicode(String(entry[0]));
    const rawTeam = cleanUnicode(String(entry[1]));
    const affiliate = rawTeam.startsWith("\u2192");
    return [{
      year,
      team: affiliate ? rawTeam.slice(1).trim() : rawTeam,
      affiliate,
      current: /present/i.test(year),
    }];
  });
};

/** Render career teams JSON from the database as a timeline list. */
export const filterTeams = (teams: string) => {
  const stints = parseTeams(teams);
  if (!stints.length) return null;
  return (
    <ol className="timeline">
      {stints.map((stint, index) => {
        const className = [stint.affiliate ? "is-affiliate" : "", stint.current ? "is-current" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <li key={`${stint.year}-${stint.team}-${index}`} className={className || undefined}>
            <span className="timeline-year tabular">{stint.year}</span>
            <span className="timeline-team">{stint.team}</span>
          </li>
        );
      })}
    </ol>
  );
};
