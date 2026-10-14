import type {Severity, SeverityQueriesCount} from "./severity.ts";
import type {UpdateQuery} from "../utils/sql-types.ts";
import type {RawWarning} from "./problems.ts";
import {forEachCritical, normalizeWhereClause} from "./common.ts";

const severityMinQueriesCount: SeverityQueriesCount = {
    level1: 3,
    level2: 5,
    level3: 9
};

export function checkIterativeUpdates(queries: UpdateQuery[]): RawWarning[] {
    const warnings: RawWarning[] = [];
    const patternCounts = mapByTableAndWhere(queries);

    const countMap: Map<string, number> = new Map(
        Array.from(patternCounts, ([key, val]) => [key, val.count])
    );

    forEachCritical(countMap, severityMinQueriesCount, (key: string, q: number, s: Severity) => {
        const entry = patternCounts.get(key);
        const tableName:string = entry ? entry.table : key.split(":")[0];
        const sampleWhere:string = entry? entry.sampleWhere : key.split(":")[1];

        warnings.push({
            type: "Iterative Updates",
            severity: s,
            message: `Table '${tableName}' received ${q} iterative UPDATE queries with matching WHERE structure (${sampleWhere}).`
        });
    });

    return warnings;
}

function mapByTableAndWhere(queries: UpdateQuery[]) {
    const map = new Map<string, { count: number; table: string; sampleWhere: string }>();
    for (const q of queries) {
        const whereClause: string|undefined = normalizeWhereClause(q.where);
        if (!whereClause) continue;
        const key = `${q.table}:${whereClause}`;
        const existing = map.get(key);

        if (existing) {
            existing.count++;
        } else {
            map.set(key, {
                count: 1,
                table: q.table,
                sampleWhere: whereClause
            });
        }
    }
    return map;
}