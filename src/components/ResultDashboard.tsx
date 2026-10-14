import ResultBox from "./ResultBox.tsx";
import type {Counts} from "../statistics/counts.ts";
import {type Warning} from "../statistics/problems.ts";
import type {TableCounts} from "../statistics/countByTable.ts";
import QueryTable from "./QueryTable.tsx";
import Warnings from "./Warnings.tsx";
import {type RefObject, useState} from "react";
import Button from "../ui/Button.tsx";
import {copyResultsToClipboard, getSeverityCountsText} from "../utils/copyResults.ts";

export type AnalysisState = "idle" | "loading" | "done";

interface ResultDashboardProps {
    counts:Counts|undefined,
    warnings:Warning[]|undefined,
    groupedByTable:TableCounts|undefined,
    resultsRef:RefObject<HTMLDivElement|null>,
    analysisState: AnalysisState,
    copyResultsRef:RefObject<HTMLButtonElement|null>
}

export default function ResultDashboard({
                                            counts,
                                            warnings,
                                            groupedByTable,
                                            resultsRef,
                                            analysisState,
                                            copyResultsRef
}:ResultDashboardProps) {

    const countAll:number|undefined = counts ? (counts.selectCount
        + counts.insertCount + counts.updateCount + counts.deleteCount) : undefined;

    const [copied, setCopied] = useState<boolean>(false);

    async function copyResults(): Promise<void> {
        if (analysisState !== "done" || !counts) return;

        const success: boolean = await copyResultsToClipboard(counts, warnings, groupedByTable);
        if (success) {
            setCopied(true);
            setTimeout((): void => setCopied(false), 2000);
        }
    }

    return (
        <div ref={resultsRef} className="p-2">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl">Results</h2>
                <Button
                    ref={copyResultsRef}
                    text={copied ? "Copied! ✓" : "Copy Results"}
                    onClick={copyResults}
                    disabled={analysisState !== "done"}
                    variant={copied ? "success" : "primary"}
                />
            </div>
            <div className="flex flex-col gap-2">
                { analysisState === "idle" && (
                    <p className="text-gray-400 italic">No analysis performed yet. Paste a SQL log and click Analyze.</p>
                )}
                { analysisState === "loading" && (
                    <p className="text-indigo-600 font-semibold animate-pulse">Analyzing SQL queries...</p>
                )}
                { analysisState === "done" && (
                    <>
                        { (counts && warnings) &&
                            <ResultBox title="Query & Problem Summary">
                                <p>
                                    <strong>Total: {countAll}</strong>
                                    {" · "}Select: {counts.selectCount}, Insert: {counts.insertCount},
                                    Update: {counts.updateCount}, Delete: {counts.deleteCount}
                                </p>
                                <p>
                                    {warnings.length} {warnings.length === 1 ? "warning" : "warnings"} ({getSeverityCountsText(warnings)})
                                </p>
                            </ResultBox>
                        }
                        { groupedByTable &&
                            <ResultBox title="Queries by Table">
                                <QueryTable queries={groupedByTable} />
                            </ResultBox>
                        }
                        { warnings &&
                            <ResultBox title="Warnings">
                                <Warnings warnings={warnings} />
                            </ResultBox>
                        }
                    </>
                )}
            </div>

        </div>
    );
}

