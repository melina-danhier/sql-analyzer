import type {Warning} from "../statistics/problems.ts";
import type {Severity} from "../statistics/severity.ts";

interface WarningsProps {
    warnings:Warning[]
}

export default function Warnings({
                                     warnings
}:WarningsProps) {

    function getColor(severity:Severity):string {
        switch (severity.level) {
            case 1: return "bg-yellow-100 border-yellow-500";
            case 2: return "bg-orange-100 border-orange-400";
            case 3: return "bg-red-100 border-red-500";
        }
        return "";
    }

    if (warnings.length === 0) return <p className="text-gray-400 italic">No warnings detected</p>;

    return (
        <div className="flex flex-col gap-2">
            {warnings.map((warning:Warning) => (
                <div key={warning.id} className={"px-3 py-2 rounded-xl border " + getColor(warning.severity)}>
                    <span className="font-semibold">
                        ⚠️ {warning.type} ({warning.severity.name}):
                    </span>
                    <span> {warning.message}</span>
                </div>
            ))}
        </div>
    );


}