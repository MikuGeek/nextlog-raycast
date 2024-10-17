export interface Preferences {
  logseqApiUrl: string;
  logseqApiToken: string;
  logseqGraphName: string;
}

export interface Page {
  id: string;
  name: string;
  content: string;
}

export interface Block {
  uuid: string;
  content: string;
  page: {
    name: string;
  };
  children?: Block[];
}

export interface QuickAddArguments {
  type: string;
  text: string;
}

export function extractUrl(content: string): string | null {
  // This regex matches URLs more accurately, including those in parentheses
  const urlRegex = /(?:https?:\/\/|www\.)[^\s)]+(?:\([^\s)]*\)[^\s)]*)*[^\s).]*/gi;
  const match = content.match(urlRegex);
  if (match) {
    // Clean up the URL by removing trailing punctuation
    return match[0].replace(/[.,;:!?]$/, "");
  }
  return null;
}


export function cleanContent(content: string): string {
  const lines = content.split("\n");
  let formattedContent = "";
  let currentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;

    const indentLevel = lines[i].search(/\S|$/);
    const levelDiff = indentLevel - currentLevel;

    if (levelDiff > 0) {
      currentLevel = indentLevel;
    } else if (levelDiff < 0) {
      currentLevel = indentLevel;
      formattedContent += "\n";
    }

    formattedContent += "  ".repeat(currentLevel) + "- " + line + "\n";
  }

  return formattedContent;
}

export const fuseOptions = {
  keys: ["name", "content"],
  threshold: 0.2,
  includeMatches: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
  findAllMatches: true,
};
