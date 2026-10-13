import type {DeleteQuery, InsertQuery, SelectQuery, SQLQuery, UpdateQuery} from "./sql-types.ts";

const prefixRegexes: RegExp[] = [
    /^.*?Hibernate:\s*/i,
    /^.*?org\.hibernate\.SQL\s*:\s*/i
];

const logLineHeaderRegex = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/;

export const queryTypes: string[] = [
    "select", "update", "insert", "delete"
];

export interface GroupedQueries {
    select: SelectQuery[];
    insert: InsertQuery[];
    update: UpdateQuery[];
    delete: DeleteQuery[];
}

export class InputNotValidError extends Error {
    constructor(message = "No valid query found") {
        super(message);
        this.name = "InputNotValidError";
    }
}

export function parseLogToGroupedQueries(log: string): GroupedQueries {
    const rawStatements: string[] = extractStatements(log);
    const queries: SQLQuery[] = tokenizeAndMapLines(rawStatements);
    return groupQueries(queries);
}

function extractStatements(log: string): string[] {
    if (!log || log.trim().length < 5) {
        throw new InputNotValidError();
    }

    const lines = log.split(/\r?\n/);
    const statements: string[] = [];
    let currentTokens: string[] = [];
    let isCollecting = false;

    function flushCurrent(): void {
        if (currentTokens.length > 0) {
            const statement = currentTokens.join(" ").replace(/;+\s*$/, "").trim();
            if (statement.length > 0 && queryTypes.some(t => statement.toLowerCase().startsWith(t))) {
                statements.push(statement);
            }
            currentTokens = [];
        }
        isCollecting = false;
    }

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (trimmed.length === 0) continue;

        // Check for Hibernate prefixes
        let content = trimmed;
        let matchedPrefix = false;
        for (const p of prefixRegexes) {
            if (p.test(content)) {
                content = content.replace(p, "").trim();
                matchedPrefix = true;
                break;
            }
        }

        const isNewLogLine = !matchedPrefix && logLineHeaderRegex.test(trimmed);
        const startsWithKeyword = queryTypes.some(t => content.toLowerCase().startsWith(t));

        if (matchedPrefix) {
            flushCurrent();
            if (content.length > 0) {
                currentTokens.push(content);
                isCollecting = true;
            } else {
                // Multi-line Hibernate query starting on next line
                isCollecting = true;
            }
        } else if (startsWithKeyword) {
            flushCurrent();
            currentTokens.push(content);
            isCollecting = true;
        } else if (isNewLogLine) {
            // New unrelated log entry (e.g. TRACE org.hibernate.orm.jdbc.bind)
            flushCurrent();
        } else if (isCollecting) {
            // Continuation of multi-line query
            currentTokens.push(content);
        }

        if (isCollecting && content.endsWith(";")) {
            flushCurrent();
        }
    }

    flushCurrent();

    if (statements.length === 0) {
        throw new InputNotValidError();
    }

    return statements;
}

function tokenizeAndMapLines(lines: string[]): SQLQuery[] {
    function tokenizeSelect(line: string): Omit<SelectQuery, "id"> {
        const tableMatch: RegExpMatchArray | null = line.match(/\bFROM\s+([a-zA-Z0-9_]+)/i);
        const table: string = tableMatch ? tableMatch[1] : "unknown";
        const whereMatch: RegExpMatchArray | null = line.match(
            /\bWHERE\s+(.+?)(?:\s+(?:GROUP\s+BY|ORDER\s+BY|LIMIT|OFFSET|FETCH\s+FIRST|FOR\s+UPDATE)\b|;|$)/i
        );
        const where: string | undefined = whereMatch ? whereMatch[1].trim() : undefined;
        const isParameterQuery: boolean = line.includes("?") || /:\w+/.test(line);
        return { type: "select", raw: line, table, where, isParameterQuery };
    }

    function tokenizeInsert(line: string): Omit<InsertQuery, "id"> {
        const table: string = line.match(/\bINTO\s+([a-zA-Z0-9_]+)/i)?.[1] ?? "unknown";
        return { type: "insert", raw: line, table };
    }

    function tokenizeUpdate(line: string): Omit<UpdateQuery, "id"> {
        const table: string = line.match(/\bUPDATE\s+([a-zA-Z0-9_]+)/i)?.[1] ?? "unknown";
        const whereMatch: RegExpMatchArray | null = line.match(
            /\bWHERE\s+(.+?)(?:\s+(?:ORDER\s+BY|LIMIT|RETURNING)\b|;|$)/i
        );
        const where: string | undefined = whereMatch ? whereMatch[1].trim() : undefined;
        return { type: "update", raw: line, where, table };
    }

    function tokenizeDelete(line: string): Omit<DeleteQuery, "id"> {
        const table: string = line.match(/\bFROM\s+([a-zA-Z0-9_]+)/i)?.[1]
            ?? line.match(/\bDELETE\s+([a-zA-Z0-9_]+)/i)?.[1]
            ?? "unknown";
        const whereMatch: RegExpMatchArray | null = line.match(
            /\bWHERE\s+(.+?)(?:\s+(?:ORDER\s+BY|LIMIT|RETURNING)\b|;|$)/i
        );
        const where: string | undefined = whereMatch ? whereMatch[1].trim() : undefined;
        return { type: "delete", raw: line, table, where };
    }

    function getFirstWord(line: string): string {
        const match: RegExpMatchArray | null = line.trim().match(/^\S+/);
        return match ? match[0] : "";
    }

    return lines.map((line: string, index: number): SQLQuery => {
        const firstWord: string = getFirstWord(line);
        const sqlQueryWithoutId: Omit<SQLQuery, "id"> = (() => {
            switch (firstWord.toLowerCase()) {
                case "select": return tokenizeSelect(line);
                case "update": return tokenizeUpdate(line);
                case "insert": return tokenizeInsert(line);
                case "delete": return tokenizeDelete(line);
                default: throw new InputNotValidError();
            }
        })();
        return { id: index, ...sqlQueryWithoutId };
    });
}

function groupQueries(queries: SQLQuery[]): GroupedQueries {
    return {
        select: queries.filter((q: SQLQuery): q is SelectQuery => q.type === "select"),
        insert: queries.filter((q: SQLQuery): q is InsertQuery => q.type === "insert"),
        update: queries.filter((q: SQLQuery): q is UpdateQuery => q.type === "update"),
        delete: queries.filter((q: SQLQuery): q is DeleteQuery => q.type === "delete")
    };
}
