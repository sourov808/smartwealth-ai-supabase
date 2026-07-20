"use client";

import { Surface } from "@/components/ui/surface";

/**
 * The inline markdown renderer for assistant messages.
 *
 * Moved out of `chat-assistant.tsx` unchanged in behavior — same line-by-line
 * scan, same regex, same block/inline precedence. Only the class names differ.
 */
export function parseMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = "";

  const processInline = (lineText: string, keyPrefix: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    const inlineMatches = Array.from(lineText.matchAll(regex));

    inlineMatches.forEach((m, matchIndex) => {
      const matchText = m[0];
      const matchStart = m.index ?? 0;

      if (matchStart > lastIndex) {
        parts.push(
          <span key={`${keyPrefix}-text-${matchIndex}`}>
            {lineText.substring(lastIndex, matchStart)}
          </span>
        );
      }

      if (matchText.startsWith("**") && matchText.endsWith("**")) {
        parts.push(
          <strong key={`${keyPrefix}-bold-${matchIndex}`} className="font-semibold text-ink">
            {matchText.slice(2, -2)}
          </strong>
        );
      } else if (matchText.startsWith("`") && matchText.endsWith("`")) {
        parts.push(
          <code
            key={`${keyPrefix}-code-${matchIndex}`}
            className="rounded bg-paper-sunken px-1 py-0.5 font-mono text-xs text-ink"
          >
            {matchText.slice(1, -1)}
          </code>
        );
      }

      lastIndex = matchStart + matchText.length;
    });

    if (lastIndex < lineText.length) {
      parts.push(
        <span key={`${keyPrefix}-text-end`}>{lineText.substring(lastIndex)}</span>
      );
    }

    return parts.length > 0 ? parts : lineText;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check code block
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <Surface
            key={`codeblock-${i}`}
            variant="inset"
            className="my-2 overflow-x-auto p-3 font-mono text-xs"
          >
            {codeBlockLang && (
              <div className="eyebrow mb-1.5 border-b border-rule pb-1 text-ink-faint">
                {codeBlockLang}
              </div>
            )}
            <pre className="overflow-x-auto">
              <code>{codeBlockContent.join("\n")}</code>
            </pre>
          </Surface>
        );
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = "";
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = line.trim().substring(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Check headings
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h5 key={`h5-${i}`} className="mt-3 mb-1 text-xs font-semibold text-ink">
          {processInline(trimmed.substring(4), `h5-${i}`)}
        </h5>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h4 key={`h4-${i}`} className="mt-4 mb-1 text-xs font-semibold text-ink">
          {processInline(trimmed.substring(3), `h4-${i}`)}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="display mt-4 mb-2 text-base text-ink">
          {processInline(trimmed.substring(2), `h3-${i}`)}
        </h3>
      );
      continue;
    }

    // Check bullets
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={`bullet-${i}`} className="my-0.5 ml-4 list-disc pl-0.5 text-ink-muted">
          {processInline(trimmed.replace(/^[-*]\s+/, ""), `bullet-${i}`)}
        </li>
      );
      continue;
    }

    // Check numbered
    if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <li key={`numbered-${i}`} className="my-0.5 ml-4 list-decimal pl-0.5 text-ink-muted">
          {processInline(trimmed.replace(/^\d+\.\s+/, ""), `numbered-${i}`)}
        </li>
      );
      continue;
    }

    // Horizontal rule
    if (trimmed === "---") {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-rule" />);
      continue;
    }

    // Empty lines (spacing)
    if (trimmed === "") {
      elements.push(<div key={`space-${i}`} className="h-1.5" />);
      continue;
    }

    // Default paragraph
    elements.push(
      <p key={`p-${i}`} className="text-ink">
        {processInline(line, `p-${i}`)}
      </p>
    );
  }

  // Handle case where code block was not closed
  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <Surface
        key="codeblock-unclosed"
        variant="inset"
        className="my-2 overflow-x-auto p-3 font-mono text-xs"
      >
        <pre className="overflow-x-auto">
          <code>{codeBlockContent.join("\n")}</code>
        </pre>
      </Surface>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

/** Renders one assistant message body. */
export function MessageContent({ content }: { content: string }) {
  return <>{parseMarkdown(content)}</>;
}
