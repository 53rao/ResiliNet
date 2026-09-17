"use client";

import React from "react";

/**
 * Renders LLM-generated markdown-ish text using the same bento-mitigation
 * card/list visual language as the Raw Optimization tab, instead of dumping
 * raw "**bold**" / "### heading" / "| table |" syntax as plain text.
 * Deliberately dependency-free: builds React nodes directly, never
 * dangerouslySetInnerHTML, since the source text comes from an LLM.
 */

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "hr" }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "table"; rows: string[][] };

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableSeparator(cells: string[]): boolean {
  return cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() });
      i++;
      continue;
    }

    // Table
    if (isTableRow(line)) {
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      const filtered = rows.filter((r) => !isTableSeparator(r));
      if (filtered.length > 0) blocks.push({ type: "table", rows: filtered });
      continue;
    }

    // List (bullet or ordered)
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (bulletMatch || orderedMatch) {
      const ordered = !!orderedMatch;
      const items: string[] = [];
      while (i < lines.length) {
        const m = ordered ? lines[i].match(/^\s*\d+\.\s+(.*)$/) : lines[i].match(/^\s*[-*]\s+(.*)$/);
        if (!m) break;
        items.push(m[1].trim());
        i++;
      }
      blocks.push({ type: "list", items, ordered });
      continue;
    }

    // Paragraph: accumulate until blank line / next special block
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*(---|\*\*\*|___)\s*$/.test(lines[i]) &&
      !isTableRow(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join(" ").trim() });
  }

  return blocks;
}

/** Renders **bold** and *italic* inline spans without HTML injection. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter((p) => p !== "");
  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function AgentMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);

  return (
    <div className="agent-md">
      {blocks.map((block, idx) => {
        const key = `block-${idx}`;
        switch (block.type) {
          case "heading":
            return (
              <p key={key} className={`agent-md-heading agent-md-heading--${block.level}`}>
                {renderInline(block.text, key)}
              </p>
            );
          case "hr":
            return <div key={key} className="agent-md-divider" />;
          case "paragraph":
            return (
              <p key={key} className="agent-md-paragraph">
                {renderInline(block.text, key)}
              </p>
            );
          case "list":
            return (
              <div key={key} className="bento-mitigation-list agent-md-list">
                {block.items.map((item, itemIdx) => (
                  <div key={`${key}-${itemIdx}`} className="bento-mitigation-item">
                    <div className="bento-mitigation-num">
                      {block.ordered ? itemIdx + 1 : "•"}
                    </div>
                    <p className="bento-mitigation-text">{renderInline(item, `${key}-${itemIdx}`)}</p>
                  </div>
                ))}
              </div>
            );
          case "table": {
            const [header, ...body] = block.rows;
            return (
              <div key={key} className="bento-mitigation-list agent-md-list">
                {body.map((row, rowIdx) => (
                  <div key={`${key}-${rowIdx}`} className="bento-mitigation-item">
                    <div className="bento-mitigation-num">•</div>
                    <p className="bento-mitigation-text">
                      {row.map((cell, cellIdx) => (
                        <React.Fragment key={`${key}-${rowIdx}-${cellIdx}`}>
                          {cellIdx > 0 && <span className="agent-md-table-sep"> — </span>}
                          {header[cellIdx] && (
                            <strong>{renderInline(header[cellIdx], `${key}-h-${cellIdx}`)}: </strong>
                          )}
                          {renderInline(cell, `${key}-${rowIdx}-${cellIdx}`)}
                        </React.Fragment>
                      ))}
                    </p>
                  </div>
                ))}
              </div>
            );
          }
        }
      })}
    </div>
  );
}
