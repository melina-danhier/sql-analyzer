import { describe, it, expect } from 'vitest';
import { checkNPlusOne } from './nPlusOne.ts';
import type { SelectQuery } from '../utils/sql-types.ts';

function createSelectQuery(table: string, where?: string, raw?: string, id: number = 1): SelectQuery {
    return {
        id,
        type: 'select',
        table,
        where,
        raw: raw ?? (where ? `SELECT * FROM ${table} WHERE ${where};` : `SELECT * FROM ${table};`),
        isParameterQuery: where?.includes('?') ?? false
    };
}

describe('checkNPlusOne', () => {
    describe('Positive cases (warning detection & severity escalation)', () => {
        it('detects N+1 pattern and triggers Minor warning when threshold (>= 3) is reached', () => {
            const queries: SelectQuery[] = [
                createSelectQuery('users', 'id = 1', undefined, 1),
                createSelectQuery('users', 'id = 2', undefined, 2),
                createSelectQuery('users', 'id = 3', undefined, 3)
            ];

            const warnings = checkNPlusOne(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('N+1');
            expect(warnings[0].severity.level).toBe(1);
            expect(warnings[0].severity.name).toBe('Minor');
            expect(warnings[0].message).toBe(
                "Table 'users' received 3 repeated SELECT queries with matching WHERE structure (id = ?)."
            );
        });

        it('escalates to Moderate warning at 6 repeated queries', () => {
            const queries: SelectQuery[] = Array.from({ length: 6 }, (_, i) =>
                createSelectQuery('orders', `customer_id = ${i + 1}`, undefined, i + 1)
            );

            const warnings = checkNPlusOne(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('N+1');
            expect(warnings[0].severity.level).toBe(2);
            expect(warnings[0].severity.name).toBe('Moderate');
            expect(warnings[0].message).toBe(
                "Table 'orders' received 6 repeated SELECT queries with matching WHERE structure (customer_id = ?)."
            );
        });

        it('escalates to Critical warning at 10 or more repeated queries', () => {
            const queries: SelectQuery[] = Array.from({ length: 12 }, (_, i) =>
                createSelectQuery('order_items', `order_id = ${i + 1}`, undefined, i + 1)
            );

            const warnings = checkNPlusOne(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('N+1');
            expect(warnings[0].severity.level).toBe(3);
            expect(warnings[0].severity.name).toBe('Critical');
            expect(warnings[0].message).toBe(
                "Table 'order_items' received 12 repeated SELECT queries with matching WHERE structure (order_id = ?)."
            );
        });

        it('detects repeated queries without WHERE clause and omits WHERE detail', () => {
            const queries: SelectQuery[] = [
                createSelectQuery('app_config', undefined, undefined, 1),
                createSelectQuery('app_config', undefined, undefined, 2),
                createSelectQuery('app_config', undefined, undefined, 3)
            ];

            const warnings = checkNPlusOne(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('N+1');
            expect(warnings[0].message).toBe("Table 'app_config' received 3 repeated SELECT queries.");
        });
    });

    describe('Negative cases (no false alerts)', () => {
        it('returns no warnings for a single query or two queries (below threshold of 3)', () => {
            const singleQuery = [createSelectQuery('users', 'id = 1')];
            expect(checkNPlusOne(singleQuery)).toHaveLength(0);

            const twoQueries = [
                createSelectQuery('users', 'id = 1', undefined, 1),
                createSelectQuery('users', 'id = 2', undefined, 2)
            ];
            expect(checkNPlusOne(twoQueries)).toHaveLength(0);
        });

        it('returns no warnings when queries are distributed across different tables below threshold', () => {
            const queries: SelectQuery[] = [
                createSelectQuery('users', 'id = 1', undefined, 1),
                createSelectQuery('users', 'id = 2', undefined, 2),
                createSelectQuery('orders', 'id = 1', undefined, 3),
                createSelectQuery('orders', 'id = 2', undefined, 4),
                createSelectQuery('products', 'id = 1', undefined, 5),
                createSelectQuery('products', 'id = 2', undefined, 6)
            ];

            const warnings = checkNPlusOne(queries);
            expect(warnings).toHaveLength(0);
        });

        it('returns no warnings when queries on the same table have structurally different WHERE clauses', () => {
            const queries: SelectQuery[] = [
                createSelectQuery('users', 'id = 1', undefined, 1),
                createSelectQuery('users', 'email = ?', undefined, 2),
                createSelectQuery('users', 'status = ?', undefined, 3),
                createSelectQuery('users', 'created_at > ?', undefined, 4),
                createSelectQuery('users', 'role = ? AND active = true', undefined, 5)
            ];

            const warnings = checkNPlusOne(queries);
            expect(warnings).toHaveLength(0);
        });
    });

    describe('Boundary cases', () => {
        it('returns empty array when input is empty', () => {
            expect(checkNPlusOne([])).toEqual([]);
        });

        it('tests exact threshold transitions (2 -> 3 -> 5 -> 6 -> 9 -> 10)', () => {
            const generateQueries = (n: number) =>
                Array.from({ length: n }, (_, i) => createSelectQuery('audit', `record_id = ${i}`, undefined, i + 1));

            // Below level 1
            expect(checkNPlusOne(generateQueries(2))).toHaveLength(0);

            // Exactly level 1 (Minor)
            const at3 = checkNPlusOne(generateQueries(3));
            expect(at3).toHaveLength(1);
            expect(at3[0].severity.level).toBe(1);

            // Upper bound of level 1
            const at5 = checkNPlusOne(generateQueries(5));
            expect(at5).toHaveLength(1);
            expect(at5[0].severity.level).toBe(1);

            // Exactly level 2 (Moderate)
            const at6 = checkNPlusOne(generateQueries(6));
            expect(at6).toHaveLength(1);
            expect(at6[0].severity.level).toBe(2);

            // Upper bound of level 2
            const at9 = checkNPlusOne(generateQueries(9));
            expect(at9).toHaveLength(1);
            expect(at9[0].severity.level).toBe(2);

            // Exactly level 3 (Critical)
            const at10 = checkNPlusOne(generateQueries(10));
            expect(at10).toHaveLength(1);
            expect(at10[0].severity.level).toBe(3);
        });
    });

    describe('Legitimate SQL pattern normalization & false positive prevention', () => {
        it('normalizes queries with varying table aliases to the same pattern', () => {
            const queries: SelectQuery[] = [
                createSelectQuery('users', 'u1.account_id = 10', undefined, 1),
                createSelectQuery('users', 'u2.account_id = 20', undefined, 2),
                createSelectQuery('users', 'alias_x.account_id = 30', undefined, 3)
            ];

            const warnings = checkNPlusOne(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toContain('(account_id = ?)');
        });

        it('normalizes varying IN lists into a unified structure', () => {
            const queries: SelectQuery[] = [
                createSelectQuery('products', 'category_id in (1, 2)', undefined, 1),
                createSelectQuery('products', 'category_id in (3, 4, 5)', undefined, 2),
                createSelectQuery('products', 'category_id in (6)', undefined, 3)
            ];

            const warnings = checkNPlusOne(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toContain('(category_id in (?))');
        });

        it('normalizes differences in casing and whitespace in WHERE clauses', () => {
            const queries: SelectQuery[] = [
                createSelectQuery('users', 'STATUS = 1', undefined, 1),
                createSelectQuery('users', 'status  =   2', undefined, 2),
                createSelectQuery('users', 'Status = 3', undefined, 3)
            ];

            const warnings = checkNPlusOne(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toContain('(status = ?)');
        });

        it('masks string literals containing special characters or escaped quotes', () => {
            const queries: SelectQuery[] = [
                createSelectQuery('customers', "company = 'O''Reilly'", undefined, 1),
                createSelectQuery('customers', "company = 'ACME Corp'", undefined, 2),
                createSelectQuery('customers', "company = 'Initech'", undefined, 3)
            ];

            const warnings = checkNPlusOne(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toContain('(company = ?)');
        });
    });
});
