import React from "react";

const APA_VARS = /\b([MSDpNntFr])\b/g;

function italicizeApaVars(label) {
  if (!label) return label;
  const parts = [];
  let last = 0;
  let match;
  const re = /\b([MSDpNntFr])\b/g;
  while ((match = re.exec(label)) !== null) {
    if (match.index > last) parts.push(label.slice(last, match.index));
    parts.push(<em key={match.index}>{match[1]}</em>);
    last = match.index + match[1].length;
  }
  if (last < label.length) parts.push(label.slice(last));
  return parts.length > 0 ? parts : label;
}

let tableCounter = 0;

export default function ApaTable({ columns = [], rows = [], caption, footnote }) {
  const tableNum = React.useRef(++tableCounter).current;

  return (
    <div style={s.wrapper}>
      {caption && (
        <div style={s.caption}>
          Table {tableNum}. {caption}
        </div>
      )}

      <table style={s.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  ...s.th,
                  textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
                }}
              >
                {italicizeApaVars(col.label)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={ri === rows.length - 1 ? s.lastRow : {}}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    ...s.td,
                    textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
                  }}
                >
                  {row[col.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ ...s.td, textAlign: "center", opacity: 0.5 }}>
                No data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {footnote && (
        <div style={s.footnote}>
          <em>Note.</em> {footnote}
        </div>
      )}
    </div>
  );
}

const s = {
  wrapper: {
    marginBottom: 24,
  },
  caption: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--shell-text)",
    marginBottom: 6,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontVariantNumeric: "tabular-nums",
    fontSize: 13,
  },
  th: {
    fontStyle: "italic",
    fontWeight: 600,
    fontSize: 13,
    padding: "8px 12px",
    borderTop: "1px solid var(--shell-text)",
    borderBottom: "1px solid var(--shell-text)",
    color: "var(--shell-text)",
    background: "transparent",
    textAlign: "left",
  },
  td: {
    fontSize: 13,
    padding: "6px 12px",
    color: "var(--shell-text-secondary)",
    background: "transparent",
    textAlign: "left",
  },
  lastRow: {
    borderBottom: "1px solid var(--shell-text)",
  },
  footnote: {
    fontSize: 11,
    fontStyle: "italic",
    color: "var(--shell-text-muted)",
    marginTop: 6,
  },
};
