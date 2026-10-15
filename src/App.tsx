import "./App.css";
import Header from "./components/Header.tsx";
import ResultDashboard, {type AnalysisState} from "./components/ResultDashboard.tsx";
import Input from "./components/Input.tsx";
import Presets from "./components/Presets.tsx";

import {type GroupedQueries, InputNotValidError, parseLogToGroupedQueries} from "./utils/parser.ts";
import {type RefObject, useRef, useState} from "react";
import {type Counts, countTypes} from "./statistics/counts.ts";
import {findPotentialProblems, type Warning} from "./statistics/problems.ts";
import {groupAndCountByTable, type TableCounts} from "./statistics/countByTable.ts";
import Message, {type Status} from "./components/Message.tsx";

export default function App() {
    const [logText, setLogText] = useState<string>("");
    const [queries, setQueries] = useState<GroupedQueries>();
    const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
    const [status, setStatus] = useState<Status>(null);

    const resultsRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
    const copyResultsRef: RefObject<HTMLButtonElement | null> = useRef<HTMLButtonElement>(null);
    const analyzeTimeoutRef = useRef<number | null>(null);

    const counts: Counts | undefined = countTypes(queries);
    const warnings: Warning[] | undefined = findPotentialProblems(queries);
    const groupedByTable: TableCounts | undefined = groupAndCountByTable(queries);

    function analyse(log: string): void {
        if (analyzeTimeoutRef.current) {
            window.clearTimeout(analyzeTimeoutRef.current);
            analyzeTimeoutRef.current = null;
        }

        setStatus(null);

        if (!log || log.trim().length === 0) {
            setStatus("emptyInput");
            setAnalysisState("idle");
            return;
        }

        setQueries(undefined);
        setAnalysisState("loading");

        analyzeTimeoutRef.current = window.setTimeout((): void => {
            try {
                const parsed: GroupedQueries = parseLogToGroupedQueries(log);
                setQueries(parsed);
                setAnalysisState("done");

                requestAnimationFrame((): void => {
                    const isStacked: boolean = !window.matchMedia("(min-width: 768px)").matches;
                    if (isStacked) {
                        resultsRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                        });
                        copyResultsRef.current?.focus();
                    }
                });
            } catch (e: unknown) {
                if (e instanceof InputNotValidError) {
                    setStatus("inputNotValid");
                }
                setAnalysisState("idle");
            }
        }, 600);
    }

    function clearInputAndResult(): void {
        if (analyzeTimeoutRef.current) {
            window.clearTimeout(analyzeTimeoutRef.current);
            analyzeTimeoutRef.current = null;
        }

        if (!logText && !queries) return;

        setLogText("");
        setQueries(undefined);
        setAnalysisState("idle");
        setStatus(null);
    }

    return (
        <div className="flex flex-col h-full">
            <Header />
            <main className="flex flex-col md:flex-row flex-1 p-4 gap-4">
                <div className="flex-1 min-w-0 p-4 flex flex-col gap-6">
                    <Message
                        status={status}
                        setStatus={setStatus}
                    />
                    <Input
                        logText={logText}
                        setLogText={setLogText}
                        analyse={analyse}
                        isAnalyzing={analysisState === "loading"}
                        clearInputAndResult={clearInputAndResult}
                    />
                    <hr className="w-full border-t-2 my-2 border-gray-500" />
                    <Presets
                        setInputText={(text: string): void => {
                            setLogText(text);
                            setStatus(null);
                        }}
                    />
                </div>

                <div className="w-full h-0.5 md:w-0.5 md:h-full shrink-0 bg-gray-500"></div>

                <div className="flex-1 min-w-0">
                    <ResultDashboard
                        counts={counts}
                        warnings={warnings}
                        groupedByTable={groupedByTable}
                        resultsRef={resultsRef}
                        analysisState={analysisState}
                        copyResultsRef={copyResultsRef}
                    />
                </div>
            </main>
        </div>
    );
}