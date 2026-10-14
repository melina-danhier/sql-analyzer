export type Status = null | "inputNotValid" | "emptyInput";

interface MessageProps {
    status: Status;
    setStatus: (s: Status) => void;
}

export default function Message({ status, setStatus }: MessageProps) {
    function getText(status: Status): string {
        switch (status) {
            case "inputNotValid":
                return "Input contains no valid SQL or Hibernate query!";
            case "emptyInput":
                return "Log input cannot be empty. Please paste your SQL log.";
            default:
                return "";
        }
    }

    if (!status) return null;

    return (
        <div className="bg-red-100 px-3 py-2 border-2 border-red-300 rounded-lg w-full text-center flex justify-between items-center text-red-900">
            <p className="m-0 font-medium">⚠️ {getText(status)}</p>
            <button
                type="button"
                aria-label="Dismiss message"
                className="text-gray-500 hover:text-gray-800 text-xl font-bold cursor-pointer px-2 leading-none"
                onClick={() => setStatus(null)}
            >
                &times;
            </button>
        </div>
    );
}
