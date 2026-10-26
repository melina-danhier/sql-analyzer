import type {Warning} from "../statistics/problems.ts";
import type {Severity} from "../statistics/severity.ts";

interface WarningsProps {
    warnings: Warning[];
}

export default function Warnings({ warnings }: WarningsProps) {
    function getColor(severity: Severity): string {
        switch (severity.level) {
            case 1:
                return "bg-amber-50 border-amber-300 text-amber-950";
            case 2:
                return "bg-orange-50 border-orange-300 text-orange-950";
            case 3:
                return "bg-rose-50 border-rose-300 text-rose-950";
        }
        return "";
    }

    function getBadgeColor(severity: Severity): string {
        switch (severity.level) {
            case 1:
                return "bg-amber-200 text-amber-900 border-amber-300";
            case 2:
                return "bg-orange-200 text-orange-900 border-orange-300";
            case 3:
                return "bg-rose-200 text-rose-900 border-rose-300";
        }
        return "";
    }

    function getDefaultHint(warning: Warning): string {
        if (warning.hint) return warning.hint;
        switch (warning.type) {
            case "N+1":
                return "Iterative single-row queries indicate missing eager fetching (JOIN FETCH, @EntityGraph) or batch fetching (@BatchSize).";
            case "Dangerous Statement":
                return "Unfiltered mutation affects all rows in the table. Ensure this table-wide operation is intentional.";
            case "Missing Batching":
                return "Repetitive individual INSERTs create unnecessary network round-trips. Enable JDBC batching (hibernate.jdbc.batch_size) or multi-row INSERTs.";
            case "Iterative Updates":
                return "Repetitive UPDATEs with matching filter criteria. Consider bulk UPDATE statements or reviewing ORM dirty checking.";
            case "Full Table Scan":
                return "SELECT without WHERE or LIMIT clause. Harmless for small lookup tables, but can trigger a full sequential table scan as data grows.";
            case "Query Count":
                return "High total query density for a single log trace. For a single HTTP request lifecycle, check for query amplification or missing caching.";
            default:
                return "Static pattern warning based on heuristic SQL log analysis.";
        }
    }

    if (warnings.length === 0) return <p className="text-gray-400 italic">No warnings detected</p>;

    return (
        <div className="flex flex-col gap-3">
            <div className="text-xs text-slate-700 bg-slate-100 border border-slate-300 rounded-lg p-2.5 flex items-start gap-2 shadow-xs">
                <span className="text-base select-none" aria-hidden="true">ℹ️</span>
                <div className="leading-snug">
                    <span className="font-semibold text-slate-900">Heuristic Analysis Notice: </span>
                    <span>
                        Warnings are static pattern indicators and query frequency heuristics from logs. They highlight potential structural bottlenecks and dangerous anti-patterns, but are <em>not</em> real-world runtime benchmarks, I/O measurements, or database execution plans (<code className="px-1 py-0.5 bg-slate-200 text-slate-800 rounded font-mono text-2xs">EXPLAIN</code>).
                    </span>
                </div>
            </div>

            <div className="flex flex-col gap-2.5">
                {warnings.map((warning: Warning) => (
                    <div
                        key={warning.id}
                        className={"p-3 rounded-xl border flex flex-col gap-1.5 transition-all shadow-xs " + getColor(warning.severity)}
                    >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-semibold text-sm flex items-center gap-1.5">
                                <span>⚠️</span>
                                <span>{warning.type}</span>
                                <span className="text-xs opacity-75">({warning.severity.name}):</span>
                            </span>
                            <span className={"text-xs px-2 py-0.5 rounded-full font-semibold border " + getBadgeColor(warning.severity)}>
                                Level {warning.severity.level} · {warning.severity.name}
                            </span>
                        </div>
                        <p className="text-sm m-0 leading-relaxed font-mono text-xs md:text-sm break-all font-medium">
                            {warning.message}
                        </p>
                        <p className="text-xs text-slate-700 italic m-0 pt-1 border-t border-black/10">
                            💡 <strong>Heuristic context:</strong> {getDefaultHint(warning)}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
