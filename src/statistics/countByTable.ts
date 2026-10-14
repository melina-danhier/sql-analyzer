import type {GroupedQueries} from "../utils/parser.ts";
import type {SQLQuery} from "../utils/sql-types.ts";

export interface TableCounts {
    select: Map<string,number>,
    insert: Map<string,number>,
    update: Map<string,number>,
    delete: Map<string,number>
}

export function groupAndCountByTable(queries:GroupedQueries|undefined):TableCounts|undefined {
    if (!queries) return undefined;
    return {
        select: countByTable(queries.select),
        insert: countByTable(queries.insert),
        update: countByTable(queries.update),
        delete: countByTable(queries.delete)
    }
}

export function countByTable(queries:SQLQuery[]):Map<string,number> {
    const queryMap = new Map<string, number>();
    queries.forEach((query:SQLQuery):void => {
        let count:number = 1;
        const oldValue:number|undefined = queryMap.get(query.table);
        if (oldValue) count = oldValue + 1;
        queryMap.set(query.table,count);
    });
    return queryMap;
}