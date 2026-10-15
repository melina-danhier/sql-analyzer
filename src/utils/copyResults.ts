import type {Counts} from "../statistics/counts.ts";
import type {Warning} from "../statistics/problems.ts";
import type {TableCounts} from "../statistics/countByTable.ts";
import {severity} from "../statistics/severity.ts";

export function getSeverityCountsText(warnings: Warning[] | undefined): string {
    if (!warnings) return "";
    const count1: number = warnings.filter((w: Warning): boolean => w.severity === severity.level1).length;
    const count2: number = warnings.filter((w: Warning): boolean => w.severity === severity.level2).length;
    const count3: number = warnings.filter((w: Warning): boolean => w.severity === severity.level3).length;
    return `${severity.level1.name}: ${count1}, ${severity.level2.name}: ${count2}, ${severity.level3.name}: ${count3}`;
}

export function formatResultsAsText(
    counts: Counts | undefined,
    warnings: Warning[] | undefined,
    groupedByTable: TableCounts | undefined
): string {
    const lines: string[] = [];
    lines.push("=== SQL Analysis Results ===");
    lines.push("");

    const countAll: number | undefined = counts
        ? counts.selectCount + counts.insertCount + counts.updateCount + counts.deleteCount
        : undefined;

    if (counts && warnings) {
        lines.push("--- Query & Problem Summary ---");
        lines.push(`Total: ${countAll}`);
        lines.push(`Select: ${counts.selectCount}, Insert: ${counts.insertCount}, Update: ${counts.updateCount}, Delete: ${counts.deleteCount}`);
        lines.push(`${warnings.length} ${warnings.length === 1 ? "warning" : "warnings"} (${getSeverityCountsText(warnings)})`);
        lines.push("");
    }

    if (groupedByTable) {
        lines.push("--- Queries by Table ---");
        const tableNames: string[] = Array.from(
            new Set([
                ...groupedByTable.select.keys(),
                ...groupedByTable.insert.keys(),
                ...groupedByTable.update.keys(),
                ...groupedByTable.delete.keys(),
            ])
        ).sort();

        if (tableNames.length === 0) {
            lines.push("No query data available");
        } else {
            lines.push("Table | Select | Insert | Update | Delete");
            for (const table of tableNames) {
                const s: number = groupedByTable.select.get(table) ?? 0;
                const i: number = groupedByTable.insert.get(table) ?? 0;
                const u: number = groupedByTable.update.get(table) ?? 0;
                const d: number = groupedByTable.delete.get(table) ?? 0;
                lines.push(`${table} | ${s} | ${i} | ${u} | ${d}`);
            }
        }
        lines.push("");
    }

    if (warnings) {
        lines.push("--- Warnings ---");
        if (warnings.length === 0) {
            lines.push("No warnings detected");
        } else {
            for (const w of warnings) {
                lines.push(`- [${w.severity.name}] ${w.type}: ${w.message}`);
            }
        }
    }

    return lines.join("\n");
}

export async function copyResultsToClipboard(
    counts: Counts | undefined,
    warnings: Warning[] | undefined,
    groupedByTable: TableCounts | undefined
): Promise<boolean> {
    const text: string = formatResultsAsText(counts, warnings, groupedByTable);

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            const textarea: HTMLTextAreaElement = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const success: boolean = document.execCommand("copy");
            document.body.removeChild(textarea);
            return success;
        }
    } catch (err: unknown) {
        console.error("Failed to copy results to clipboard", err);
        return false;
    }
}
