import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  emphasis?: boolean;
  render?: (row: T) => ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
}

/** Scrollable data table with configurable columns and row keys. */
function Table<T extends Record<string, any>>({ columns, rows, rowKey }: Props<T>) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className={`align-${col.align ?? "right"}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)} style={{ ["--i" as string]: Math.min(index, 20) }}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`align-${col.align ?? "right"} ${col.emphasis ? "is-emphasis" : ""}`}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
