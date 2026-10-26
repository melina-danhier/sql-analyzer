import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import Warnings from "./Warnings.tsx";
import type {Warning} from "../statistics/problems.ts";
import {severity} from "../statistics/severity.ts";

describe("Warnings Component", () => {
    it("renders empty state message when no warnings are present", () => {
        render(<Warnings warnings={[]} />);
        expect(screen.getByText("No warnings detected")).toBeInTheDocument();
        expect(screen.queryByText(/Heuristic Analysis Notice/i)).not.toBeInTheDocument();
    });

    it("renders heuristic analysis notice and warning details when warnings are present", () => {
        const warnings: Warning[] = [
            {
                id: 1,
                type: "N+1",
                message: "Table 'orders' received 3 repeated SELECT queries with matching WHERE structure (customer_id = ?).",
                severity: severity.level1,
                hint: "Iterative single-row queries indicate missing eager fetching (JOIN FETCH, @EntityGraph) or batch fetching (@BatchSize)."
            }
        ];

        render(<Warnings warnings={warnings} />);

        // Check heuristic notice
        expect(screen.getByText(/Heuristic Analysis Notice:/i)).toBeInTheDocument();
        expect(screen.getByText(/real-world runtime benchmarks/i)).toBeInTheDocument();

        // Check warning content
        expect(screen.getByText("N+1")).toBeInTheDocument();
        expect(screen.getByText(/Level 1 · Minor/i)).toBeInTheDocument();
        expect(screen.getByText(/Table 'orders' received 3 repeated SELECT queries/i)).toBeInTheDocument();
        expect(screen.getByText(/Iterative single-row queries indicate missing eager fetching/i)).toBeInTheDocument();
    });

    it("falls back to default hint when custom hint is omitted", () => {
        const warnings: Warning[] = [
            {
                id: 1,
                type: "Dangerous Statement",
                message: "Statement without WHERE clause: DELETE FROM sessions;",
                severity: severity.level3
            }
        ];

        render(<Warnings warnings={warnings} />);

        expect(screen.getByText("Dangerous Statement")).toBeInTheDocument();
        expect(screen.getByText(/Level 3 · Critical/i)).toBeInTheDocument();
        expect(screen.getByText(/Unfiltered mutation affects all rows in the table/i)).toBeInTheDocument();
    });

    it("renders distinct severity levels with appropriate badges", () => {
        const warnings: Warning[] = [
            {
                id: 1,
                type: "Full Table Scan",
                message: "An unbounded query (possible full table scan) was executed on table 'products'.",
                severity: severity.level1
            },
            {
                id: 2,
                type: "Iterative Updates",
                message: "Table 'accounts' received 5 iterative UPDATE queries with matching WHERE structure (id = ?).",
                severity: severity.level2
            },
            {
                id: 3,
                type: "Dangerous Statement",
                message: "Statement without WHERE clause: UPDATE users SET active = 0;",
                severity: severity.level3
            }
        ];

        render(<Warnings warnings={warnings} />);

        expect(screen.getByText(/Level 1 · Minor/i)).toBeInTheDocument();
        expect(screen.getByText(/Level 2 · Moderate/i)).toBeInTheDocument();
        expect(screen.getByText(/Level 3 · Critical/i)).toBeInTheDocument();
        expect(screen.getByText("Full Table Scan")).toBeInTheDocument();
        expect(screen.getByText("Iterative Updates")).toBeInTheDocument();
        expect(screen.getByText("Dangerous Statement")).toBeInTheDocument();
    });
});
