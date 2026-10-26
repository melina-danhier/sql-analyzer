import type {RawWarning} from "./problems.ts";
import type {SelectQuery} from "../utils/sql-types.ts";
import {forEachCritical, normalizeWhereClause} from "./common.ts";
import type {Severity, SeverityQueriesCount} from "./severity.ts";

const severityMinQueriesCount:SeverityQueriesCount = {
    level1: 3,
    level2: 6,
    level3: 10
}

export function checkNPlusOne(queries: SelectQuery[]): RawWarning[] {
    const warnings: RawWarning[] = [];
    const patternCounts = mapByTableAndWhere(queries);

    const countMap = new Map<string, number>(
        Array.from(patternCounts, ([key, val]) => [key, val.count])
    );

    forEachCritical(countMap, severityMinQueriesCount, (key: string, q: number, s: Severity): void => {
        const entry = patternCounts.get(key);
        const tableName: string = entry ? entry.table : key.split(":")[0];
        const sampleWhere: string | undefined = entry?.sampleWhere;
        const whereDetail = sampleWhere ? ` with matching WHERE structure (${sampleWhere})` : "";

        warnings.push({
            type: "N+1",
            message: `Table '${tableName}' received ${q} repeated SELECT queries${whereDetail}.`,
            severity: s,
            hint: "Iterative single-row queries indicate missing eager fetching (JOIN FETCH, @EntityGraph) or batch fetching (@BatchSize)."
        });
    });

    return warnings;
}

function mapByTableAndWhere(queries: SelectQuery[]) {
    const map = new Map<string, { count: number; table: string; sampleWhere?: string }>();
    for (const q of queries) {
        const normalizedWhere: string | undefined = normalizeWhereClause(q.where);
        const key = `${q.table}:${normalizedWhere ?? "*"}`;
        const existing = map.get(key);

        if (existing) {
            existing.count++;
        } else {
            map.set(key, {
                count: 1,
                table: q.table,
                sampleWhere: normalizedWhere
            });
        }
    }
    return map;
}
