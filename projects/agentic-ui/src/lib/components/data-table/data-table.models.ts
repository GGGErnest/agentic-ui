/** Typed row for the facade DataTable. */
export interface DataRow {
  [key: string]: unknown;
}

/** Search query for findRow — matches against any column. */
export interface RowQuery {
  column?: string;
  value: string;
}

/** Bulk edit operation. */
export interface BulkEditOp {
  ids: string[];
  changes: Record<string, unknown>;
}

/** Result from a data table operation. */
export interface DataTableResult {
  success: boolean;
  message: string;
  affectedRows?: number;
  foundRows?: DataRow[];
}
