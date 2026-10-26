import type {SelectQuery} from "../utils/sql-types.ts";
import type {RawWarning} from "./problems.ts";
import {severity} from "./severity.ts";

export function checkFullTableScans(queries:SelectQuery[]):RawWarning[] {
    const warnings:RawWarning[] = [];

    queries.forEach((query:SelectQuery) => {
        const limitExists:boolean = /\b(limit\b|fetch\s+(?:first|next)\b|top\s*\(?\d+\)?)/i.test(query.raw);
        const hasWhere:boolean = Boolean(query.where && query.where.trim().length > 0);
        if (!limitExists && !hasWhere) {
            warnings.push({
                type: "Full Table Scan",
                severity: severity.level1,
                message: `An unbounded query (possible full table scan) was executed on table '${query.table}'.`,
                hint: "SELECT without WHERE or LIMIT clause. Harmless for small lookup tables, but can trigger a full sequential table scan as data grows."
            });
        }
    });

    return warnings;
}
