import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  headerClassName?: string;
  cell: (row: T, index: number) => ReactNode;
  cellClassName?: string | ((row: T, index: number) => string | undefined);
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T, index: number) => string | number;
  stickyHeader?: boolean;
  /** Skip default border/hover on body rows. */
  plainRows?: boolean;
  headerClassName?: string;
  headerRowClassName?: string;
  rowClassName?: string | ((row: T, index: number) => string | undefined);
  maxHeight?: string;
  minWidth?: number | string;
  containerClassName?: string;
  className?: string;
};

/** Column-driven table built on the low-level Table primitives. */
export function DataTable<T>({
  columns,
  data,
  getRowKey,
  stickyHeader,
  plainRows,
  headerClassName,
  headerRowClassName,
  rowClassName,
  maxHeight,
  minWidth,
  containerClassName,
  className,
}: DataTableProps<T>) {
  return (
    <Table maxHeight={maxHeight} minWidth={minWidth} containerClassName={containerClassName} className={className}>
      <TableHeader sticky={stickyHeader} className={headerClassName}>
        <TableRow plain className={headerRowClassName}>
          {columns.map((column) => (
            <TableHead key={column.id} className={column.headerClassName}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, index) => {
          const resolvedRowClass =
            typeof rowClassName === "function" ? rowClassName(row, index) : rowClassName;
          return (
            <TableRow key={getRowKey(row, index)} plain={plainRows} className={resolvedRowClass}>
              {columns.map((column) => {
                const resolvedCellClass =
                  typeof column.cellClassName === "function"
                    ? column.cellClassName(row, index)
                    : column.cellClassName;
                return (
                  <TableCell key={column.id} className={resolvedCellClass}>
                    {column.cell(row, index)}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

type TableProps = HTMLAttributes<HTMLTableElement> & {
  /** Max height of the scroll container (CSS length). Enables overflow-y-auto. */
  maxHeight?: string;
  /** Min width of the table (px number or CSS length). */
  minWidth?: number | string;
  /** Extra classes on the outer scroll wrapper. */
  containerClassName?: string;
};

export function Table({
  className,
  containerClassName,
  maxHeight,
  minWidth,
  style,
  children,
  ...props
}: TableProps) {
  const minWidthCss = minWidth == null ? undefined : typeof minWidth === "number" ? `${minWidth}px` : minWidth;

  return (
    <div
      className={cx(
        "overflow-x-auto overscroll-contain",
        maxHeight ? "overflow-y-auto" : null,
        containerClassName,
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table
        className={cx("w-full text-left text-sm", className)}
        style={{ ...style, ...(minWidthCss ? { minWidth: minWidthCss } : null) }}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

type TableHeaderProps = HTMLAttributes<HTMLTableSectionElement> & {
  sticky?: boolean;
};

export function TableHeader({ className, sticky, children, ...props }: TableHeaderProps) {
  return (
    <thead
      className={cx(
        sticky ? "sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--wsu-border)]" : null,
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

type TableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  /** Disable default border + hover styles. */
  plain?: boolean;
};

export function TableRow({ className, plain, children, ...props }: TableRowProps) {
  return (
    <tr
      className={cx(
        !plain && "border-b border-[color:var(--wsu-border)] last:border-0 hover:bg-[color:var(--wsu-stone)]/60",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cx("px-4 py-2.5 text-xs font-medium text-[color:var(--wsu-muted)]", className)}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx("px-4 py-3 text-[color:var(--wsu-ink)]", className)} {...props}>
      {children}
    </td>
  );
}
