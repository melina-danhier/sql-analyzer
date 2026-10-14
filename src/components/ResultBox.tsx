import type {ReactNode} from "react";

interface ResultBoxProps {
    title:string,
    children:ReactNode
}

export default function ResultBox({
                                      title,
                                      children
}:ResultBoxProps) {
    return (
        <div className="border-2 rounded px-3 py-2 border-indigo-400 bg-indigo-100">
            <h3 className="text-lg font-bold mb-1">
                {title}
            </h3>
            {children}
        </div>
    );
}