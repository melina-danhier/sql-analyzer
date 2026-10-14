import Button from "../ui/Button.tsx";
import type { FormEvent } from "react";

interface InputProps {
    logText: string;
    setLogText: (text: string) => void;
    analyse: (log: string) => void;
    isAnalyzing: boolean;
    clearInputAndResult: () => void;
}

export default function Input({
    logText,
    setLogText,
    analyse,
    isAnalyzing,
    clearInputAndResult
}: InputProps) {

    function handleSubmit(e: FormEvent<HTMLFormElement>): void {
        e.preventDefault();
        analyse(logText);
    }

    const isEmpty = logText.trim().length === 0;

    return (
        <form
            className="flex flex-col gap-2 items-center w-full"
            onSubmit={handleSubmit}
        >
            <textarea
                name="logText"
                value={logText}
                onChange={(e) => setLogText(e.target.value)}
                className="border rounded-md min-w-70 min-h-60 px-3 py-2 w-full font-mono text-sm"
                placeholder="Paste your SQL or Hibernate log here..."
            />
            <div className="flex gap-4">
                <Button
                    type="submit"
                    text={isAnalyzing ? "Analyzing..." : "Analyze"}
                    disabled={isAnalyzing || isEmpty}
                />
                <Button
                    type="button"
                    text="Reset"
                    variant="danger"
                    disabled={isAnalyzing || isEmpty}
                    onClick={clearInputAndResult}
                />
            </div>
        </form>
    );
}