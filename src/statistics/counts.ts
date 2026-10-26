import type {GroupedQueries} from "../utils/parser.ts";
import type {RawWarning} from "./problems.ts";
import type {Severity, SeverityQueriesCount} from "./severity.ts";
import {getSeverity} from "./common.ts";

export interface Counts {
    selectCount:number,
    insertCount:number,
    updateCount:number,
    deleteCount:number
}

export function countTypes(queries:GroupedQueries|undefined):Counts|undefined {
    if (!queries) return undefined;
    return {
        selectCount: queries.select.length,
        insertCount: queries.insert.length,
        updateCount: queries.update.length,
        deleteCount: queries.delete.length
    };
}

const severityMinQueriesCounts:SeverityQueriesCount = {
    level1: 20,
    level2: 40,
    level3: 80
}

export function checkCountAll(queries:GroupedQueries|undefined):RawWarning[] {
    if (!queries) return [];
    const warnings:RawWarning[] = [];
    const count:number = queries.select.length + queries.insert.length
        + queries.update.length + queries.delete.length;
    const severity:Severity|undefined = getSeverity(severityMinQueriesCounts,count);
    if (severity) {
        warnings.push({
            type: "Query Count",
            severity,
            message: `${count} queries were executed.`,
            hint: "High total query density for a single log trace. For a single HTTP request lifecycle, check for query amplification or missing caching."
        });
    }
    return warnings;
}
