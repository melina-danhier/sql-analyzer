import { describe, it, expect } from 'vitest';
import { checkMissingBatchingInsert } from './missingBatching.ts';
import type { InsertQuery } from '../utils/sql-types.ts';

function createInsertQuery(table: string, raw?: string, id: number = 1): InsertQuery {
    return {
        id,
        type: 'insert',
        table,
        raw: raw ?? `INSERT INTO ${table} (val) VALUES (${id});`
    };
}

describe('checkMissingBatchingInsert', () => {
    describe('Positive cases (threshold alerts & escalation)', () => {
        it('flags table when 3 INSERT queries are performed with Minor severity', () => {
            const queries: InsertQuery[] = [
                createInsertQuery('logs', undefined, 1),
                createInsertQuery('logs', undefined, 2),
                createInsertQuery('logs', undefined, 3)
            ];

            const warnings = checkMissingBatchingInsert(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('Missing Batching');
            expect(warnings[0].severity.level).toBe(1);
            expect(warnings[0].severity.name).toBe('Minor');
            expect(warnings[0].message).toBe("Table 'logs' received 3 INSERT queries.");
        });

        it('escalates to Moderate severity at 6 INSERT queries', () => {
            const queries: InsertQuery[] = Array.from({ length: 6 }, (_, i) =>
                createInsertQuery('events', undefined, i + 1)
            );

            const warnings = checkMissingBatchingInsert(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('Missing Batching');
            expect(warnings[0].severity.level).toBe(2);
            expect(warnings[0].severity.name).toBe('Moderate');
            expect(warnings[0].message).toBe("Table 'events' received 6 INSERT queries.");
        });

        it('escalates to Critical severity at 10 or more INSERT queries', () => {
            const queries: InsertQuery[] = Array.from({ length: 15 }, (_, i) =>
                createInsertQuery('metrics', undefined, i + 1)
            );

            const warnings = checkMissingBatchingInsert(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('Missing Batching');
            expect(warnings[0].severity.level).toBe(3);
            expect(warnings[0].severity.name).toBe('Critical');
            expect(warnings[0].message).toBe("Table 'metrics' received 15 INSERT queries.");
        });

        it('generates distinct warnings for each table exceeding the threshold', () => {
            const queries: InsertQuery[] = [
                ...Array.from({ length: 3 }, (_, i) => createInsertQuery('orders', undefined, i + 1)),
                ...Array.from({ length: 4 }, (_, i) => createInsertQuery('audit_logs', undefined, i + 10))
            ];

            const warnings = checkMissingBatchingInsert(queries);

            expect(warnings).toHaveLength(2);
            const tables = warnings.map(w => w.message);
            expect(tables).toContain("Table 'orders' received 3 INSERT queries.");
            expect(tables).toContain("Table 'audit_logs' received 4 INSERT queries.");
        });
    });

    describe('Negative cases (no false alerts)', () => {
        it('returns no warnings for 1 or 2 INSERT queries', () => {
            expect(checkMissingBatchingInsert([createInsertQuery('users')])).toHaveLength(0);
            expect(checkMissingBatchingInsert([
                createInsertQuery('users', undefined, 1),
                createInsertQuery('users', undefined, 2)
            ])).toHaveLength(0);
        });

        it('returns no warnings when INSERTs are spread across distinct tables below threshold', () => {
            const queries: InsertQuery[] = [
                createInsertQuery('table_a', undefined, 1),
                createInsertQuery('table_a', undefined, 2),
                createInsertQuery('table_b', undefined, 3),
                createInsertQuery('table_b', undefined, 4),
                createInsertQuery('table_c', undefined, 5),
                createInsertQuery('table_d', undefined, 6)
            ];

            const warnings = checkMissingBatchingInsert(queries);
            expect(warnings).toHaveLength(0);
        });

        it('does not falsely trigger when a single multi-row batch insert is executed', () => {
            const batchInsert = createInsertQuery(
                'records',
                'INSERT INTO records (a, b) VALUES (1, 2), (3, 4), (5, 6), (7, 8);',
                1
            );

            const warnings = checkMissingBatchingInsert([batchInsert]);
            expect(warnings).toHaveLength(0);
        });
    });

    describe('Boundary cases', () => {
        it('returns empty array when input is empty', () => {
            expect(checkMissingBatchingInsert([])).toEqual([]);
        });

        it('tests exact threshold transitions (2 -> 3 -> 5 -> 6 -> 9 -> 10)', () => {
            const generateInserts = (n: number) =>
                Array.from({ length: n }, (_, i) => createInsertQuery('telemetry', undefined, i + 1));

            // Below level 1
            expect(checkMissingBatchingInsert(generateInserts(2))).toHaveLength(0);

            // Exactly level 1 (Minor)
            const at3 = checkMissingBatchingInsert(generateInserts(3));
            expect(at3).toHaveLength(1);
            expect(at3[0].severity.level).toBe(1);

            // Upper bound of level 1
            const at5 = checkMissingBatchingInsert(generateInserts(5));
            expect(at5).toHaveLength(1);
            expect(at5[0].severity.level).toBe(1);

            // Exactly level 2 (Moderate)
            const at6 = checkMissingBatchingInsert(generateInserts(6));
            expect(at6).toHaveLength(1);
            expect(at6[0].severity.level).toBe(2);

            // Upper bound of level 2
            const at9 = checkMissingBatchingInsert(generateInserts(9));
            expect(at9).toHaveLength(1);
            expect(at9[0].severity.level).toBe(2);

            // Exactly level 3 (Critical)
            const at10 = checkMissingBatchingInsert(generateInserts(10));
            expect(at10).toHaveLength(1);
            expect(at10[0].severity.level).toBe(3);
        });
    });
});
