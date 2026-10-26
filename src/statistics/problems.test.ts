import { describe, it, expect } from 'vitest';
import { findPotentialProblems, findPotentiellProblems, type Warning } from './problems.ts';
import { parseLogToGroupedQueries, type GroupedQueries } from '../utils/parser.ts';
import { presets } from '../utils/presets.ts';
import type { SelectQuery, InsertQuery, UpdateQuery, DeleteQuery } from '../utils/sql-types.ts';

describe('findPotentialProblems', () => {
    describe('Empty and falsy inputs', () => {
        it('returns undefined when input is undefined', () => {
            expect(findPotentialProblems(undefined)).toBeUndefined();
        });

        it('returns empty array when all query groups are empty', () => {
            const emptyGroup: GroupedQueries = {
                select: [],
                insert: [],
                update: [],
                delete: []
            };

            const warnings = findPotentialProblems(emptyGroup);
            expect(warnings).toEqual([]);
        });
    });

    describe('Combined analysis results', () => {
        it('aggregates multiple distinct problem types into a single list with sequential IDs', () => {
            // Construct a grouped query set containing multiple distinct problem heuristics:
            // 1. 3 repeated SELECTs on 'users' -> N+1 (Minor)
            // 2. 1 unbounded SELECT on 'metrics' -> Full Table Scan (Minor)
            // 3. 3 single INSERTs on 'audit_log' -> Missing Batching (Minor)
            // 4. 3 iterative UPDATEs on 'orders' -> Iterative Updates (Minor)
            // 5. 1 DELETE without WHERE on 'temp_sessions' -> Dangerous Statement (Critical)
            // 6. 1 UPDATE without WHERE on 'cache' -> Dangerous Statement (Critical)
            const selects: SelectQuery[] = [
                { id: 1, type: 'select', table: 'users', where: 'id = 1', raw: 'SELECT * FROM users WHERE id = 1;', isParameterQuery: false },
                { id: 2, type: 'select', table: 'users', where: 'id = 2', raw: 'SELECT * FROM users WHERE id = 2;', isParameterQuery: false },
                { id: 3, type: 'select', table: 'users', where: 'id = 3', raw: 'SELECT * FROM users WHERE id = 3;', isParameterQuery: false },
                { id: 4, type: 'select', table: 'metrics', raw: 'SELECT * FROM metrics;', isParameterQuery: false }
            ];

            const inserts: InsertQuery[] = [
                { id: 5, type: 'insert', table: 'audit_log', raw: "INSERT INTO audit_log (msg) VALUES ('a');" },
                { id: 6, type: 'insert', table: 'audit_log', raw: "INSERT INTO audit_log (msg) VALUES ('b');" },
                { id: 7, type: 'insert', table: 'audit_log', raw: "INSERT INTO audit_log (msg) VALUES ('c');" }
            ];

            const updates: UpdateQuery[] = [
                { id: 8, type: 'update', table: 'orders', where: 'id = 1', raw: 'UPDATE orders SET status = 1 WHERE id = 1;' },
                { id: 9, type: 'update', table: 'orders', where: 'id = 2', raw: 'UPDATE orders SET status = 1 WHERE id = 2;' },
                { id: 10, type: 'update', table: 'orders', where: 'id = 3', raw: 'UPDATE orders SET status = 1 WHERE id = 3;' },
                { id: 11, type: 'update', table: 'cache', raw: 'UPDATE cache SET dirty = 0;' }
            ];

            const deletes: DeleteQuery[] = [
                { id: 12, type: 'delete', table: 'temp_sessions', raw: 'DELETE FROM temp_sessions;' }
            ];

            const grouped: GroupedQueries = {
                select: selects,
                insert: inserts,
                update: updates,
                delete: deletes
            };

            const warnings = findPotentialProblems(grouped);
            expect(warnings).toBeDefined();
            expect(warnings!.length).toBeGreaterThanOrEqual(6);

            // Verify sequential IDs starting at 1
            warnings!.forEach((w: Warning, idx: number) => {
                expect(w.id).toBe(idx + 1);
            });

            // Verify each warning category is present
            const types = warnings!.map(w => w.type);
            expect(types).toContain('N+1');
            expect(types).toContain('Dangerous Statement');
            expect(types).toContain('Missing Batching');
            expect(types).toContain('Iterative Updates');
            expect(types).toContain('Full Table Scan');
        });

        it('triggers Query Count warning when query volume threshold is exceeded (>= 20)', () => {
            // Generate 25 benign SELECT queries across 25 distinct tables to only trigger Query Count
            const selects: SelectQuery[] = Array.from({ length: 25 }, (_, i) => ({
                id: i + 1,
                type: 'select',
                table: `table_${i}`,
                where: 'id = 1',
                raw: `SELECT * FROM table_${i} WHERE id = 1;`,
                isParameterQuery: false
            }));

            const grouped: GroupedQueries = {
                select: selects,
                insert: [],
                update: [],
                delete: []
            };

            const warnings = findPotentialProblems(grouped);
            expect(warnings).toBeDefined();
            expect(warnings).toHaveLength(1);
            expect(warnings![0].type).toBe('Query Count');
            expect(warnings![0].severity.level).toBe(1);
            expect(warnings![0].severity.name).toBe('Minor');
            expect(warnings![0].message).toBe('25 queries were executed.');
        });
    });

    describe('Consistency of Severities and Warning Types', () => {
        it('ensures all generated warnings conform to strict Severity and Warning schema', () => {
            const selects: SelectQuery[] = [
                { id: 1, type: 'select', table: 'unbounded', raw: 'SELECT * FROM unbounded;', isParameterQuery: false },
                ...Array.from({ length: 10 }, (_, i) => ({
                    id: i + 2,
                    type: 'select' as const,
                    table: 'n_plus_one_table',
                    where: 'id = ?',
                    raw: 'SELECT * FROM n_plus_one_table WHERE id = ?;',
                    isParameterQuery: true
                }))
            ];

            const deletes: DeleteQuery[] = [
                { id: 12, type: 'delete', table: 'users', raw: 'DELETE FROM users;' }
            ];

            const grouped: GroupedQueries = {
                select: selects,
                insert: [],
                update: [],
                delete: deletes
            };

            const warnings = findPotentialProblems(grouped);
            expect(warnings).toBeDefined();

            const validTypes = new Set([
                'N+1',
                'Dangerous Statement',
                'Missing Batching',
                'Iterative Updates',
                'Full Table Scan',
                'Query Count',
                'other'
            ]);

            const validSeverityNames = new Set(['Minor', 'Moderate', 'Critical']);

            for (const warning of warnings!) {
                expect(typeof warning.id).toBe('number');
                expect(warning.id).toBeGreaterThan(0);
                expect(validTypes.has(warning.type)).toBe(true);
                expect([1, 2, 3]).toContain(warning.severity.level);
                expect(validSeverityNames.has(warning.severity.name)).toBe(true);
                expect(warning.message.length).toBeGreaterThan(0);
            }
        });

        it('maintains backward compatibility with alias findPotentiellProblems', () => {
            expect(findPotentiellProblems).toBe(findPotentialProblems);
        });
    });

    describe('Integration with presets and real log parser', () => {
        it('correctly analyzes the hibernateNPlusOne preset', () => {
            const grouped = parseLogToGroupedQueries(presets.hibernateNPlusOne);
            const warnings = findPotentialProblems(grouped);

            expect(warnings).toBeDefined();
            // In hibernateNPlusOne:
            // 1 unbounded SELECT on users -> Full Table Scan
            // 10 repeated SELECTs on orders -> N+1 (Critical)
            const nPlusOneWarning = warnings!.find(w => w.type === 'N+1');
            const fullScanWarning = warnings!.find(w => w.type === 'Full Table Scan');

            expect(nPlusOneWarning).toBeDefined();
            expect(nPlusOneWarning!.severity.level).toBe(3);
            expect(nPlusOneWarning!.severity.name).toBe('Critical');
            expect(nPlusOneWarning!.message).toContain("'orders'");

            expect(fullScanWarning).toBeDefined();
            expect(fullScanWarning!.message).toContain("'users'");
        });

        it('reports zero warnings for cleanBatch preset', () => {
            const grouped = parseLogToGroupedQueries(presets.cleanBatch);
            const warnings = findPotentialProblems(grouped);

            expect(warnings).toBeDefined();
            expect(warnings).toHaveLength(0);
        });
    });
});
