import type {InsertQuery} from "../utils/sql-types.ts";
import type {RawWarning} from "./problems.ts";
import {forEachCritical} from "./common.ts";
import type {Severity, SeverityQueriesCount} from "./severity.ts";
import {countByTable} from "./countByTable.ts";

const severityMinQueriesCount:SeverityQueriesCount = {
    level1: 3,
    level2: 6,
    level3: 10
}

export function checkMissingBatchingInsert(queries:InsertQuery[]):RawWarning[] {
    const warnings:RawWarning[] = [];
    const grouped:Map<string, number> = countByTable(queries);

    forEachCritical(grouped, severityMinQueriesCount, (t:string,q:number,s:Severity):void => {
        warnings.push({
            type: "Missing Batching",
            message: `Table '${t}' received ${q} INSERT queries.`,
            severity: s
        });
    });

    return warnings;
}

