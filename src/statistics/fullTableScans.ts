import type {SelectQuery} from "../utils/sql-types.ts";
import type {RawWarning} from "./problems.ts";
import {severity} from "./severity.ts";

export function checkFullTableScans(queries:SelectQuery[]):RawWarning[] {
    const warnings:RawWarning[] = [];

    queries.forEach((query:SelectQuery) => {
        const limitExists:boolean = /\b(limit\b|fetch\s+first\b|top\s+\d+)/i.test(query.raw);
        if (!limitExists && !query.where) {
            warnings.push({
                type: "Full Table Scan",
                severity: severity.level1,
                message: `An unbounded query (possible full table scan) was executed on table '${query.table}'.`
            });
        }
    });

    return warnings;
}

