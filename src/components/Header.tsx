

import logoUrl from "../assets/sql-analyzer-tool-logo.svg";

export default function Header() {
    return (
        <header className="flex bg-indigo-300 px-3 items-center">
            <img src={logoUrl}
                 className="h-18"
                 alt="SQL Analyzer Logo"
            />
            <h1 className="text-2xl font-semibold mx-2">SQL Analyzer</h1>
        </header>
    );
}
