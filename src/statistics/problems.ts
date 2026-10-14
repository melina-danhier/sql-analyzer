import {checkNPlusOne} from "./nPlusOne.ts"
import type {GroupedQueries} from "../utils/parser.ts";
import {checkMutationWithoutFilter} from "./mutationWithoutFilter.ts";
import {checkMissingBatchingInsert} from "./missingBatching.ts";
import type {Severity} from "./severity.ts";
import {checkIterativeUpdates} from "./iterativeUpdates.ts";
import {checkFullTableScans} from "./fullTableScans.ts";
import {checkCountAll} from "./counts.ts";

export type {Severity} from "./severity.ts";

export interface Warning {
    id:number,
    type: "N+1" | "Dangerous Statement" | "Missing Batching"
        | "Iterative Updates" | "Full Table Scan" | "Query Count" | "other",
    message:string,
    severity:Severity;
}

export type RawWarning = Omit<Warning, "id">;

export function findPotentialProblems(queries:GroupedQueries|undefined):Warning[]|undefined {
    if (!queries) return undefined;
    const rawWarnings:RawWarning[] = [];

    rawWarnings.push(...checkNPlusOne(queries.select));
    rawWarnings.push(...checkMutationWithoutFilter([
        ...queries.update,
        ...queries.delete
    ]));
    rawWarnings.push(...checkMissingBatchingInsert(queries.insert));
    rawWarnings.push(...checkIterativeUpdates(queries.update));
    rawWarnings.push(...checkFullTableScans(queries.select));
    rawWarnings.push(...checkCountAll(queries));

    return rawWarnings.map((w: RawWarning, index: number): Warning => ({
        ...w,
        id: index + 1
    }));
}

// Backward-compatible alias
export const findPotentiellProblems = findPotentialProblems;