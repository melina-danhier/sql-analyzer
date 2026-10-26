import { describe, it, expect } from 'vitest';
import { checkIterativeUpdates } from './iterativeUpdates.ts';
import type { UpdateQuery } from '../utils/sql-types.ts';

function createUpdateQuery(table: string, where?: string, raw?: string, id: number = 1): UpdateQuery {
    return {
        id,
        type: 'update',
        table,
        where,
        raw: raw ?? (where ? `UPDATE ${table} SET val = 1 WHERE ${where};` : `UPDATE ${table} SET val = 1;`)
    };
}

describe('checkIterativeUpdates', () => {
    describe('Positive cases (threshold alerts & escalation)', () => {
        it('detects iterative updates and triggers Minor warning at threshold (>= 3)', () => {
            const queries: UpdateQuery[] = [
                createUpdateQuery('users', 'id = 1', undefined, 1),
                createUpdateQuery('users', 'id = 2', undefined, 2),
                createUpdateQuery('users', 'id = 3', undefined, 3)
            ];

            const warnings = checkIterativeUpdates(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('Iterative Updates');
            expect(warnings[0].severity.level).toBe(1);
            expect(warnings[0].severity.name).toBe('Minor');
            expect(warnings[0].message).toBe(
                "Table 'users' received 3 iterative UPDATE queries with matching WHERE structure (id = ?)."
            );
        });

        it('escalates to Moderate warning at 5 iterative updates', () => {
            const queries: UpdateQuery[] = Array.from({ length: 5 }, (_, i) =>
                createUpdateQuery('products', `sku = '${i + 100}'`, undefined, i + 1)
            );

            const warnings = checkIterativeUpdates(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('Iterative Updates');
            expect(warnings[0].severity.level).toBe(2);
            expect(warnings[0].severity.name).toBe('Moderate');
            expect(warnings[0].message).toBe(
                "Table 'products' received 5 iterative UPDATE queries with matching WHERE structure (sku = ?)."
            );
        });

        it('escalates to Critical warning at 9 or more iterative updates', () => {
            const queries: UpdateQuery[] = Array.from({ length: 9 }, (_, i) =>
                createUpdateQuery('order_items', `item_id = ${i + 1}`, undefined, i + 1)
            );

            const warnings = checkIterativeUpdates(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('Iterative Updates');
            expect(warnings[0].severity.level).toBe(3);
            expect(warnings[0].severity.name).toBe('Critical');
            expect(warnings[0].message).toBe(
                "Table 'order_items' received 9 iterative UPDATE queries with matching WHERE structure (item_id = ?)."
            );
        });
    });

    describe('Negative cases (no false alerts)', () => {
        it('returns no warnings for 1 or 2 updates', () => {
            expect(checkIterativeUpdates([createUpdateQuery('users', 'id = 1')])).toHaveLength(0);
            expect(checkIterativeUpdates([
                createUpdateQuery('users', 'id = 1', undefined, 1),
                createUpdateQuery('users', 'id = 2', undefined, 2)
            ])).toHaveLength(0);
        });

        it('returns no warnings when updates on the same table have structurally different WHERE clauses', () => {
            const queries: UpdateQuery[] = [
                createUpdateQuery('users', 'id = 1', undefined, 1),
                createUpdateQuery('users', 'email = ?', undefined, 2),
                createUpdateQuery('users', 'status = ?', undefined, 3),
                createUpdateQuery('users', 'created_at < ?', undefined, 4),
                createUpdateQuery('users', 'department = ? AND role = ?', undefined, 5)
            ];

            const warnings = checkIterativeUpdates(queries);
            expect(warnings).toHaveLength(0);
        });

        it('returns no warnings when updates are distributed across distinct tables below threshold', () => {
            const queries: UpdateQuery[] = [
                createUpdateQuery('table_a', 'id = 1', undefined, 1),
                createUpdateQuery('table_a', 'id = 2', undefined, 2),
                createUpdateQuery('table_b', 'id = 1', undefined, 3),
                createUpdateQuery('table_b', 'id = 2', undefined, 4)
            ];

            const warnings = checkIterativeUpdates(queries);
            expect(warnings).toHaveLength(0);
        });

        it('ignores UPDATE statements without WHERE clause (delegated to mutationWithoutFilter)', () => {
            const queries: UpdateQuery[] = [
                createUpdateQuery('users', undefined, undefined, 1),
                createUpdateQuery('users', undefined, undefined, 2),
                createUpdateQuery('users', undefined, undefined, 3),
                createUpdateQuery('users', undefined, undefined, 4)
            ];

            const warnings = checkIterativeUpdates(queries);
            expect(warnings).toHaveLength(0);
        });
    });

    describe('Boundary cases', () => {
        it('returns empty array when input is empty', () => {
            expect(checkIterativeUpdates([])).toEqual([]);
        });

        it('tests exact threshold transitions (2 -> 3 -> 4 -> 5 -> 8 -> 9)', () => {
            const generateUpdates = (n: number) =>
                Array.from({ length: n }, (_, i) => createUpdateQuery('inventory', `product_id = ${i}`, undefined, i + 1));

            // Below level 1
            expect(checkIterativeUpdates(generateUpdates(2))).toHaveLength(0);

            // Exactly level 1 (Minor)
            const at3 = checkIterativeUpdates(generateUpdates(3));
            expect(at3).toHaveLength(1);
            expect(at3[0].severity.level).toBe(1);

            // Upper bound of level 1
            const at4 = checkIterativeUpdates(generateUpdates(4));
            expect(at4).toHaveLength(1);
            expect(at4[0].severity.level).toBe(1);

            // Exactly level 2 (Moderate)
            const at5 = checkIterativeUpdates(generateUpdates(5));
            expect(at5).toHaveLength(1);
            expect(at5[0].severity.level).toBe(2);

            // Upper bound of level 2
            const at8 = checkIterativeUpdates(generateUpdates(8));
            expect(at8).toHaveLength(1);
            expect(at8[0].severity.level).toBe(2);

            // Exactly level 3 (Critical)
            const at9 = checkIterativeUpdates(generateUpdates(9));
            expect(at9).toHaveLength(1);
            expect(at9[0].severity.level).toBe(3);
        });
    });

    describe('Legitimate SQL pattern normalization & false positive prevention', () => {
        it('normalizes queries with table aliases to the same pattern', () => {
            const queries: UpdateQuery[] = [
                createUpdateQuery('accounts', 'a1.id = 10', undefined, 1),
                createUpdateQuery('accounts', 'a2.id = 20', undefined, 2),
                createUpdateQuery('accounts', 'acc.id = 30', undefined, 3)
            ];

            const warnings = checkIterativeUpdates(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toContain('(id = ?)');
        });

        it('normalizes varying IN lists into a unified structure', () => {
            const queries: UpdateQuery[] = [
                createUpdateQuery('users', 'id IN (1, 2)', undefined, 1),
                createUpdateQuery('users', 'id IN (3, 4, 5)', undefined, 2),
                createUpdateQuery('users', 'id IN (6)', undefined, 3)
            ];

            const warnings = checkIterativeUpdates(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toContain('(id in (?))');
        });

        it('normalizes differences in casing and whitespace in WHERE clauses', () => {
            const queries: UpdateQuery[] = [
                createUpdateQuery('customers', 'STATUS = 1', undefined, 1),
                createUpdateQuery('customers', 'status   =   2', undefined, 2),
                createUpdateQuery('customers', 'Status = 3', undefined, 3)
            ];

            const warnings = checkIterativeUpdates(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toContain('(status = ?)');
        });
    });
});
