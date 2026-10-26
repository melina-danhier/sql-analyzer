import type {DeleteQuery, InsertQuery, SelectQuery, SQLQuery, QueryType, UpdateQuery} from "./sql-types.ts";

/**
 * Supported root SQL query types.
 * Note: DDL (CREATE, DROP, ALTER) and administrative commands (EXPLAIN, SET)
 * are deliberately excluded as this tool focuses on DML statements.
 */
export const queryTypes: QueryType[] = [
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

const HIBERNATE_PREFIX_REGEXES: RegExp[] = [
    /^.*?Hibernate:\s*/i,
    /^.*?\borg\.hibernate\.SQL\s*[:-]\s*/i,
    /^.*?\bSqlStatementLogger\s*[:-]\s*/i,
];

const UNRELATED_LOG_LINE_REGEXES: RegExp[] = [
    /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/,
    /^\d{2}:\d{2}:\d{2}[.,]\d{3}/,
    /^(DEBUG|INFO|WARN|ERROR|TRACE)\b/i,
    /^(binding parameter|org\.hibernate\.orm\.jdbc\.bind|org\.hibernate\.type)/i,
    /^\[(main|nio-[^\]]+|http-[^\]]+)\]/i,
];

const TERMINATING_CLAUSE_REGEX = /^(?:GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|FETCH\s+(?:FIRST|NEXT)|FOR\s+(?:UPDATE|SHARE)|RETURNING|WINDOW|UNION|INTERSECT|EXCEPT)\b/i;

/**
 * Main entry point: Parses raw log text or SQL statements into categorized queries.
 * Throws InputNotValidError if input is empty or contains no supported DML queries.
 */
export function parseLogToGroupedQueries(log: string): GroupedQueries {
    if (!log || typeof log !== "string" || log.trim().length === 0) {
        throw new InputNotValidError("Input cannot be empty");
    }

    const rawStatements: string[] = extractStatements(log);
    const queries: SQLQuery[] = tokenizeAndMapLines(rawStatements);

    if (queries.length === 0) {
        throw new InputNotValidError();
    }

    return groupQueries(queries);
}

/**
 * Strips comments (-- single-line and /* block * /) while preserving string literals
 * and quoted identifiers.
 */
export function stripComments(sql: string): string {
    let result = "";
    let i = 0;
    const len = sql.length;

    while (i < len) {
        const char = sql[i];
        const next = sql[i + 1];

        // Single-quoted string: '...'
        if (char === "'") {
            const start = i;
            i++;
            while (i < len) {
                if (sql[i] === "'") {
                    if (sql[i + 1] === "'") {
                        i += 2; // escaped quote ''
                        continue;
                    }
                    i++;
                    break;
                } else if (sql[i] === "\\" && i + 1 < len) {
                    i += 2; // backslash escape \'
                } else {
                    i++;
                }
            }
            result += sql.slice(start, i);
            continue;
        }

        // Double-quoted identifier: "..."
        if (char === '"') {
            const start = i;
            i++;
            while (i < len) {
                if (sql[i] === '"') {
                    if (sql[i + 1] === '"') {
                        i += 2;
                        continue;
                    }
                    i++;
                    break;
                } else if (sql[i] === "\\" && i + 1 < len) {
                    i += 2;
                } else {
                    i++;
                }
            }
            result += sql.slice(start, i);
            continue;
        }

        // Backtick identifier: `...`
        if (char === "`") {
            const start = i;
            i++;
            while (i < len) {
                if (sql[i] === "`") {
                    if (sql[i + 1] === "`") {
                        i += 2;
                        continue;
                    }
                    i++;
                    break;
                }
                i++;
            }
            result += sql.slice(start, i);
            continue;
        }

        // Bracket identifier: [...]
        if (char === "[") {
            const start = i;
            i++;
            while (i < len && sql[i] !== "]") {
                i++;
            }
            if (i < len) i++;
            result += sql.slice(start, i);
            continue;
        }

        // Single-line comment: -- ...
        if (char === "-" && next === "-") {
            i += 2;
            while (i < len && sql[i] !== "\n" && sql[i] !== "\r") {
                i++;
            }
            if (i >= len) break;
            continue;
        }

        // Block comment: /* ... */
        if (char === "/" && next === "*") {
            i += 2;
            while (i < len && !(sql[i] === "*" && sql[i + 1] === "/")) {
                i++;
            }
            if (i < len) i += 2;
            result += " ";
            continue;
        }

        result += char;
        i++;
    }

    return result;
}

/**
 * Splits SQL text by semicolons while respecting string literals, quoted identifiers, and comments.
 */
export function splitStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = "";
    let i = 0;
    const len = sql.length;

    while (i < len) {
        const char = sql[i];
        const next = sql[i + 1];

        // Handle string literals
        if (char === "'") {
            const start = i;
            i++;
            while (i < len) {
                if (sql[i] === "'") {
                    if (sql[i + 1] === "'") {
                        i += 2;
                        continue;
                    }
                    i++;
                    break;
                } else if (sql[i] === "\\" && i + 1 < len) {
                    i += 2;
                } else {
                    i++;
                }
            }
            current += sql.slice(start, i);
            continue;
        }

        // Handle double-quoted identifiers
        if (char === '"') {
            const start = i;
            i++;
            while (i < len) {
                if (sql[i] === '"') {
                    if (sql[i + 1] === '"') {
                        i += 2;
                        continue;
                    }
                    i++;
                    break;
                } else if (sql[i] === "\\" && i + 1 < len) {
                    i += 2;
                } else {
                    i++;
                }
            }
            current += sql.slice(start, i);
            continue;
        }

        // Handle backtick identifiers
        if (char === "`") {
            const start = i;
            i++;
            while (i < len) {
                if (sql[i] === "`") {
                    if (sql[i + 1] === "`") {
                        i += 2;
                        continue;
                    }
                    i++;
                    break;
                }
                i++;
            }
            current += sql.slice(start, i);
            continue;
        }

        // Handle bracket identifiers
        if (char === "[") {
            const start = i;
            i++;
            while (i < len && sql[i] !== "]") {
                i++;
            }
            if (i < len) i++;
            current += sql.slice(start, i);
            continue;
        }

        // Handle single-line comments
        if (char === "-" && next === "-") {
            i += 2;
            while (i < len && sql[i] !== "\n" && sql[i] !== "\r") {
                i++;
            }
            current += " ";
            continue;
        }

        // Handle block comments
        if (char === "/" && next === "*") {
            i += 2;
            while (i < len && !(sql[i] === "*" && sql[i + 1] === "/")) {
                i++;
            }
            if (i < len) i += 2;
            current += " ";
            continue;
        }

        // Semicolon separator outside literals/comments
        if (char === ";") {
            const trimmed = current.trim();
            if (trimmed.length > 0) {
                statements.push(trimmed);
            }
            current = "";
            i++;
            continue;
        }

        current += char;
        i++;
    }

    const trimmed = current.trim();
    if (trimmed.length > 0) {
        statements.push(trimmed);
    }

    return statements;
}

/**
 * Strips Hibernate or SQL log prefixes if present on the line.
 */
export function stripHibernatePrefix(line: string): { content: string; matched: boolean } {
    for (const prefix of HIBERNATE_PREFIX_REGEXES) {
        if (prefix.test(line)) {
            return {
                content: line.replace(prefix, "").trim(),
                matched: true
            };
        }
    }
    return { content: line, matched: false };
}

/**
 * Determines whether a line looks like an unrelated log header or log output.
 */
function isUnrelatedLogLine(line: string): boolean {
    return UNRELATED_LOG_LINE_REGEXES.some(regex => regex.test(line));
}

/**
 * Returns the leading SQL keyword if one of the supported query types, otherwise null.
 */
export function getLeadingKeyword(sql: string): QueryType | null {
    const stripped = stripComments(sql).trim();
    const match = stripped.match(/^[a-zA-Z]+/);
    if (!match) return null;
    const word = match[0].toLowerCase();
    return queryTypes.includes(word as QueryType) ? (word as QueryType) : null;
}

/**
 * Calculates net parenthesis depth of a string (ignoring quotes and comments).
 */
function calculateParenDepth(text: string): number {
    let depth = 0;
    let i = 0;
    const len = text.length;

    while (i < len) {
        const char = text[i];
        if (char === "'") {
            i++;
            while (i < len && text[i] !== "'") {
                if (text[i] === "\\" && i + 1 < len) i += 2;
                else i++;
            }
            if (i < len) i++;
            continue;
        }
        if (char === '"' || char === "`") {
            const q = char;
            i++;
            while (i < len && text[i] !== q) {
                if (text[i] === "\\" && i + 1 < len) i += 2;
                else i++;
            }
            if (i < len) i++;
            continue;
        }
        if (char === "(") depth++;
        else if (char === ")") depth--;
        i++;
    }

    return depth;
}

/**
 * Checks whether content ends with a semicolon outside of quotes.
 */
function endsWithTerminalSemicolon(content: string): boolean {
    const stripped = stripComments(content).trim();
    return /;\s*$/.test(stripped);
}

/**
 * Extracts raw statement strings from log text or SQL input.
 */
export function extractStatements(log: string): string[] {
    const lines = log.split(/\r?\n/);
    const statements: string[] = [];
    let currentTokens: string[] = [];
    let isCollecting = false;

    function flushCurrent(): void {
        if (currentTokens.length > 0) {
            const block = currentTokens.join("\n").trim();
            if (block.length > 0) {
                const subStatements = splitStatements(block);
                for (const stmt of subStatements) {
                    const cleaned = stmt.trim();
                    if (cleaned.length > 0 && getLeadingKeyword(cleaned) !== null) {
                        statements.push(cleaned);
                    }
                }
            }
            currentTokens = [];
        }
        isCollecting = false;
    }

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (trimmed.length === 0) continue;

        const { content, matched: matchedPrefix } = stripHibernatePrefix(trimmed);
        const isLogHeader = !matchedPrefix && isUnrelatedLogLine(trimmed);
        const leadingKeyword = getLeadingKeyword(content);
        const startsWithKeyword = leadingKeyword !== null;

        if (matchedPrefix) {
            flushCurrent();
            if (content.length > 0) {
                currentTokens.push(content);
                isCollecting = true;
            } else {
                // "Hibernate:" alone on line, query body continues on subsequent lines
                isCollecting = true;
            }
        } else if (isLogHeader) {
            flushCurrent();
        } else if (startsWithKeyword) {
            const currentBlock = currentTokens.join("\n");
            const depth = calculateParenDepth(currentBlock);
            if (isCollecting && depth > 0) {
                // Subquery starting inside open parentheses
                currentTokens.push(content);
            } else {
                flushCurrent();
                currentTokens.push(content);
                isCollecting = true;
            }
        } else if (isCollecting) {
            currentTokens.push(content);
        }

        if (isCollecting && endsWithTerminalSemicolon(content)) {
            flushCurrent();
        }
    }

    flushCurrent();

    if (statements.length === 0) {
        throw new InputNotValidError();
    }

    return statements;
}

/**
 * Normalizes and cleans quoted or schema-qualified table identifiers.
 * e.g. '"public"."users"' -> 'public.users', '`my_db`.`orders`' -> 'my_db.orders', '[dbo].[users]' -> 'dbo.users'
 */
export function cleanIdentifier(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "unknown";

    const parts = splitQualifiedIdentifier(trimmed);
    const cleaned = parts.map((part) => {
        let p = part.trim();
        if (p.startsWith('"') && p.endsWith('"') && p.length >= 2) {
            p = p.slice(1, -1).replace(/""/g, '"').replace(/\\"/g, '"');
        } else if (p.startsWith("`") && p.endsWith("`") && p.length >= 2) {
            p = p.slice(1, -1).replace(/``/g, "`");
        } else if (p.startsWith("[") && p.endsWith("]") && p.length >= 2) {
            p = p.slice(1, -1);
        }
        return p;
    });

    const result = cleaned.filter(Boolean).join(".");
    return result || "unknown";
}

/**
 * Splits a qualified identifier by dots outside quotes.
 */
function splitQualifiedIdentifier(ident: string): string[] {
    const parts: string[] = [];
    let current = "";
    let i = 0;
    const len = ident.length;

    while (i < len) {
        const char = ident[i];
        if (char === '"' || char === "`") {
            const quote = char;
            current += char;
            i++;
            while (i < len && ident[i] !== quote) {
                current += ident[i];
                i++;
            }
            if (i < len) {
                current += ident[i];
                i++;
            }
            continue;
        }
        if (char === "[") {
            current += char;
            i++;
            while (i < len && ident[i] !== "]") {
                current += ident[i];
                i++;
            }
            if (i < len) {
                current += ident[i];
                i++;
            }
            continue;
        }
        if (char === ".") {
            parts.push(current);
            current = "";
            i++;
            continue;
        }
        current += char;
        i++;
    }

    if (current.length > 0) {
        parts.push(current);
    }

    return parts;
}

/**
 * Reads a single table identifier component (unquoted or quoted with "", ``, or [])
 * starting at offset in sql.
 */
function consumeIdentifierToken(sql: string, offset: number): { token: string; nextIndex: number } | null {
    let i = offset;
    const len = sql.length;
    while (i < len && /\s/.test(sql[i])) i++;
    if (i >= len) return null;

    const start = i;
    const firstChar = sql[i];

    if (firstChar === '"' || firstChar === "`") {
        i++;
        while (i < len && sql[i] !== firstChar) {
            if (sql[i] === "\\" && i + 1 < len) i += 2;
            else i++;
        }
        if (i < len) i++;
        return { token: sql.slice(start, i), nextIndex: i };
    }

    if (firstChar === "[") {
        i++;
        while (i < len && sql[i] !== "]") i++;
        if (i < len) i++;
        return { token: sql.slice(start, i), nextIndex: i };
    }

    const unquotedMatch = sql.slice(i).match(/^[a-zA-Z0-9_$]+/);
    if (unquotedMatch) {
        i += unquotedMatch[0].length;
        return { token: unquotedMatch[0], nextIndex: i };
    }

    return null;
}

/**
 * Reads a qualified table identifier (e.g. "schema"."table" or public.users) from offset.
 */
function readQualifiedTable(sql: string, offset: number): { table: string; nextIndex: number } {
    let i = offset;
    while (i < sql.length && /\s/.test(sql[i])) i++;

    if (i >= sql.length || sql[i] === "(") {
        return { table: "unknown", nextIndex: i };
    }

    // Skip optional PostgreSQL ONLY modifier: "FROM ONLY users"
    const onlyMatch = sql.slice(i).match(/^ONLY\s+/i);
    if (onlyMatch) {
        i += onlyMatch[0].length;
    }

    const parts: string[] = [];
    while (i < sql.length) {
        const consumed = consumeIdentifierToken(sql, i);
        if (!consumed) break;
        parts.push(consumed.token);
        i = consumed.nextIndex;

        // Check if immediately followed by a dot
        let dotIndex = i;
        while (dotIndex < sql.length && /\s/.test(sql[dotIndex])) dotIndex++;
        if (dotIndex < sql.length && sql[dotIndex] === ".") {
            i = dotIndex + 1;
            while (i < sql.length && /\s/.test(sql[i])) i++;
        } else {
            break;
        }
    }

    if (parts.length === 0) {
        return { table: "unknown", nextIndex: i };
    }

    return { table: cleanIdentifier(parts.join(".")), nextIndex: i };
}

/**
 * Extracts the primary table name from a SQL query.
 */
export function extractTable(sql: string, type: QueryType): string {
    const cleanSql = stripComments(sql);

    switch (type) {
        case "select": {
            // Find FROM at paren depth 0 to avoid subqueries in the projection list
            const fromIndex = findKeywordAtDepthZero(cleanSql, "FROM");
            if (fromIndex === -1) return "unknown";
            const afterFrom = fromIndex + 4;
            return readQualifiedTable(cleanSql, afterFrom).table;
        }
        case "insert": {
            // Find INSERT at depth 0
            const insertIndex = findKeywordAtDepthZero(cleanSql, "INSERT");
            if (insertIndex === -1) return "unknown";
            let afterInsert = insertIndex + 6;
            while (afterInsert < cleanSql.length && /\s/.test(cleanSql[afterInsert])) afterInsert++;
            const intoMatch = cleanSql.slice(afterInsert).match(/^INTO\s+/i);
            if (intoMatch) {
                afterInsert += intoMatch[0].length;
            }
            return readQualifiedTable(cleanSql, afterInsert).table;
        }
        case "update": {
            const updateIndex = findKeywordAtDepthZero(cleanSql, "UPDATE");
            if (updateIndex === -1) return "unknown";
            const afterUpdate = updateIndex + 6;
            return readQualifiedTable(cleanSql, afterUpdate).table;
        }
        case "delete": {
            // Check for FROM first (e.g. DELETE FROM table OR DELETE u FROM table u)
            const fromIndex = findKeywordAtDepthZero(cleanSql, "FROM");
            if (fromIndex !== -1) {
                const afterFrom = fromIndex + 4;
                return readQualifiedTable(cleanSql, afterFrom).table;
            }
            // Syntax omitting FROM: DELETE table WHERE ...
            const deleteIndex = findKeywordAtDepthZero(cleanSql, "DELETE");
            if (deleteIndex === -1) return "unknown";
            const afterDelete = deleteIndex + 6;
            return readQualifiedTable(cleanSql, afterDelete).table;
        }
        default:
            return "unknown";
    }
}

/**
 * Finds the index of a keyword (case-insensitive word boundary) at parenthesis depth 0
 * and outside of string literals.
 */
function findKeywordAtDepthZero(sql: string, keyword: string): number {
    let depth = 0;
    let i = 0;
    const len = sql.length;
    const kwLen = keyword.length;

    while (i < len) {
        const char = sql[i];

        if (char === "'") {
            i++;
            while (i < len && sql[i] !== "'") {
                if (sql[i] === "\\" && i + 1 < len) i += 2;
                else i++;
            }
            if (i < len) i++;
            continue;
        }

        if (char === '"' || char === "`") {
            const quote = char;
            i++;
            while (i < len && sql[i] !== quote) {
                if (sql[i] === "\\" && i + 1 < len) i += 2;
                else i++;
            }
            if (i < len) i++;
            continue;
        }

        if (char === "[") {
            i++;
            while (i < len && sql[i] !== "]") i++;
            if (i < len) i++;
            continue;
        }

        if (char === "(") {
            depth++;
            i++;
            continue;
        }
        if (char === ")") {
            if (depth > 0) depth--;
            i++;
            continue;
        }

        if (depth === 0) {
            const prevChar = i > 0 ? sql[i - 1] : " ";
            const nextChar = i + kwLen < len ? sql[i + kwLen] : " ";
            if (
                /\s|[(),;]/.test(prevChar) &&
                /\s|[(),;]/.test(nextChar) &&
                sql.slice(i, i + kwLen).toUpperCase() === keyword.toUpperCase()
            ) {
                return i;
            }
        }

        i++;
    }

    return -1;
}

/**
 * Accurately extracts the WHERE clause content of a query up to any terminating clauses
 * (e.g. ORDER BY, GROUP BY, LIMIT, FOR UPDATE, RETURNING) or statement end.
 * Subqueries in parentheses and string literals containing keywords are preserved.
 */
export function extractWhereClause(sql: string): string | undefined {
    const cleanSql = stripComments(sql);
    const whereIndex = findKeywordAtDepthZero(cleanSql, "WHERE");
    if (whereIndex === -1) return undefined;

    let i = whereIndex + 5;
    const len = cleanSql.length;
    while (i < len && /\s/.test(cleanSql[i])) i++;
    const whereStart = i;

    let depth = 0;
    while (i < len) {
        const char = cleanSql[i];

        if (char === "'") {
            i++;
            while (i < len && cleanSql[i] !== "'") {
                if (cleanSql[i] === "\\" && i + 1 < len) i += 2;
                else i++;
            }
            if (i < len) i++;
            continue;
        }

        if (char === '"' || char === "`") {
            const quote = char;
            i++;
            while (i < len && cleanSql[i] !== quote) {
                if (cleanSql[i] === "\\" && i + 1 < len) i += 2;
                else i++;
            }
            if (i < len) i++;
            continue;
        }

        if (char === "[") {
            i++;
            while (i < len && cleanSql[i] !== "]") i++;
            if (i < len) i++;
            continue;
        }

        if (char === "(") {
            depth++;
            i++;
            continue;
        }
        if (char === ")") {
            if (depth > 0) depth--;
            i++;
            continue;
        }

        if (depth === 0) {
            if (char === ";") break;

            const remaining = cleanSql.slice(i);
            const prevChar = i > 0 ? cleanSql[i - 1] : " ";
            if (/\s|[(),;]/.test(prevChar) && TERMINATING_CLAUSE_REGEX.test(remaining)) {
                break;
            }
        }

        i++;
    }

    const whereContent = cleanSql.slice(whereStart, i).replace(/;+\s*$/, "").trim();
    return whereContent.length > 0 ? whereContent : undefined;
}

/**
 * Checks whether a query contains bind parameters (?, :param, $1) outside string literals.
 */
export function hasParameter(sql: string): boolean {
    const cleanSql = stripComments(sql);
    let i = 0;
    const len = cleanSql.length;

    while (i < len) {
        const char = cleanSql[i];

        // Skip string literals
        if (char === "'") {
            i++;
            while (i < len && cleanSql[i] !== "'") {
                if (cleanSql[i] === "\\" && i + 1 < len) i += 2;
                else i++;
            }
            if (i < len) i++;
            continue;
        }

        // Positional JDBC parameter: ?
        if (char === "?") {
            return true;
        }

        // Positional PostgreSQL parameter: $1, $2, ...
        if (char === "$" && i + 1 < len && /\d/.test(cleanSql[i + 1])) {
            return true;
        }

        // Named parameter: :paramName (avoiding PostgreSQL cast ::type or time literals 12:30)
        if (char === ":") {
            const prevChar = i > 0 ? cleanSql[i - 1] : " ";
            const nextChar = i + 1 < len ? cleanSql[i + 1] : "";
            const isCast = prevChar === ":" || nextChar === ":";
            const isIdentifierStart = /[a-zA-Z_]/.test(nextChar);
            const isPrecededByIdentifier = /[a-zA-Z0-9_$]/.test(prevChar);

            if (!isCast && isIdentifierStart && !isPrecededByIdentifier) {
                return true;
            }
        }

        i++;
    }

    return false;
}

/**
 * Parses a single statement string into a SQLQuery object.
 */
export function parseStatement(raw: string, index: number): SQLQuery | null {
    const clean = stripComments(raw).trim();
    const leadingKeyword = getLeadingKeyword(clean);
    if (!leadingKeyword) return null;

    const where = extractWhereClause(clean);
    const table = extractTable(clean, leadingKeyword);

    switch (leadingKeyword) {
        case "select": {
            const isParameterQuery = hasParameter(clean);
            const selectQuery: SelectQuery = {
                id: index,
                type: "select",
                table,
                where,
                isParameterQuery,
                raw
            };
            return selectQuery;
        }
        case "insert": {
            const insertQuery: InsertQuery = {
                id: index,
                type: "insert",
                table,
                raw
            };
            return insertQuery;
        }
        case "update": {
            const updateQuery: UpdateQuery = {
                id: index,
                type: "update",
                table,
                where,
                raw
            };
            return updateQuery;
        }
        case "delete": {
            const deleteQuery: DeleteQuery = {
                id: index,
                type: "delete",
                table,
                where,
                raw
            };
            return deleteQuery;
        }
    }
}

/**
 * Tokenizes and maps extracted statement strings into structured SQLQuery objects.
 */
function tokenizeAndMapLines(statements: string[]): SQLQuery[] {
    const queries: SQLQuery[] = [];
    let nextId = 0;

    for (const stmt of statements) {
        const parsed = parseStatement(stmt, nextId);
        if (parsed) {
            queries.push(parsed);
            nextId++;
        }
    }

    return queries;
}

/**
 * Groups queries by type.
 */
function groupQueries(queries: SQLQuery[]): GroupedQueries {
    return {
        select: queries.filter((q): q is SelectQuery => q.type === "select"),
        insert: queries.filter((q): q is InsertQuery => q.type === "insert"),
        update: queries.filter((q): q is UpdateQuery => q.type === "update"),
        delete: queries.filter((q): q is DeleteQuery => q.type === "delete")
    };
}
