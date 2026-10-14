import type {TableCounts} from "../statistics/countByTable.ts";

interface QueryTableProps {
    queries: TableCounts;
}

const QUERY_TYPES = ["select", "insert", "update", "delete"] as const;

export default function QueryTable({ queries }: QueryTableProps) {
    const tableNames: string[] = Array.from(
        new Set([
            ...queries.select.keys(),
            ...queries.insert.keys(),
            ...queries.update.keys(),
            ...queries.delete.keys(),
        ])
    ).sort();

    if (tableNames.length === 0) {
        return (
            <p className="px-4 py-4 text-center italic text-gray-500">
                No query data available
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="font-semibold uppercase text-xs border-b border-indigo-200">
                    <tr>
                        <th className="px-3 py-1 text-left">Table</th>
                        {QUERY_TYPES.map((type) => (
                            <th key={type} className="py-1 text-center">
                                {type}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {tableNames.map((tableName: string) => {
                        const selectCount = queries.select.get(tableName) ?? 0;
                        const insertCount = queries.insert.get(tableName) ?? 0;
                        const updateCount = queries.update.get(tableName) ?? 0;
                        const deleteCount = queries.delete.get(tableName) ?? 0;

                        return (
                            <tr key={tableName} className="hover:bg-indigo-50/50 transition border-b border-indigo-100 last:border-b-0">
                                <td className="px-3 py-2 font-semibold text-gray-900">
                                    {tableName}
                                </td>
                                <TableCell count={selectCount} />
                                <TableCell count={insertCount} />
                                <TableCell count={updateCount} />
                                <TableCell count={deleteCount} />
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function TableCell({ count }: { count: number }) {
    return (
        <td className={`px-3 py-2 text-center font-semibold ${count === 0 ? "text-gray-400" : "text-gray-800"}`}>
            {count}
        </td>
    );
}