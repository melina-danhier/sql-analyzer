export type QueryType = "select" | "update" | "insert" | "delete";

export interface SelectQuery extends SQLQuery {
    type: "select",
    where?:string,
    isParameterQuery:boolean
}

export interface UpdateQuery extends SQLQuery {
    type: "update"
    where?: string
}

export interface InsertQuery extends SQLQuery {
    type: "insert"
}

export interface DeleteQuery extends SQLQuery {
    type: "delete",
    where?: string
}

export interface SQLQuery {
    id: number,
    type: QueryType,
    table:string
    raw:string,
}

