import {severity, type Severity, type SeverityQueriesCount} from "./severity.ts";

export function forEachCritical(
    map:Map<string, number>,
    severityCount:SeverityQueriesCount,
    func:(k:string,v:number,s:Severity) => void
):void {
    for (const [key, value] of map) {
        const sev:Severity|undefined = getSeverity(severityCount,value);
        if (!sev) continue;
        func(key,value,sev);
    }
}

export function getSeverity(severityCount:SeverityQueriesCount,queriesCount:number):Severity|undefined {
    if (queriesCount >= severityCount.level3) return severity.level3;
    if (queriesCount >= severityCount.level2) return severity.level2;
    if (queriesCount >= severityCount.level1) return severity.level1;
    return undefined;
}

export function normalizeWhereClause(line: string | undefined): string | undefined {
    if (!line) return undefined;
    return line.toLowerCase()
        // Tabellen-Aliase vor Spalten entfernen (z. B. "t1_0.id" -> "id")
        .replace(/\b[a-z0-9_]+\.([a-z0-9_]+)/g, "$1")
        // In-Listen normalisieren: in (?, ?, ?) -> in (?)
        .replace(/in\s*\([^)]*\)/g, "in (?)")
        // String-Literale maskieren ('admin@example.com' -> ?)
        .replace(/'[^']*'/g, "?")
        // Zahlenwerte maskieren (= 42 -> = ?)
        .replace(/\b\d+\b/g, "?")
        // Whitespaces vereinheitlichen
        .replace(/\s+/g, " ")
        .trim();
}