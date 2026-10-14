import type {DeleteQuery, UpdateQuery} from "../utils/sql-types.ts";
import type {RawWarning} from "./problems.ts";
import {severity} from "./severity.ts";

export function checkMutationWithoutFilter(
    queries:(UpdateQuery|DeleteQuery)[]
):RawWarning[] {

    const warnings:RawWarning[] = [];

    queries.forEach((query:UpdateQuery|DeleteQuery):void => {
        const hasFilter:boolean = Boolean(query.where && query.where.trim().length > 0)
            || /\bwhere\b/i.test(query.raw);
        if (!hasFilter) {
            warnings.push({
                type: "Dangerous Statement",
                severity: severity.level3,
                message: "Statement without WHERE clause: " + query.raw
            });
        }
    });

    return warnings;
}


