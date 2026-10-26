import { describe, it, expect } from 'vitest';
import { checkFullTableScans } from './fullTableScans.ts';
import type { SelectQuery } from '../utils/sql-types.ts';

function createSelectQuery(table: string, where?: string, raw?: string, id: number = 1): SelectQuery {
    return {
        id,
        type: 'select',
        table,
        where,
        raw: raw ?? (where ? `SELECT * FROM ${table} WHERE ${where};` : `SELECT * FROM ${table};`),
        isParameterQuery: false
    };
}

describe('checkFullTableScans', () => {
    describe('Positive cases (detection of unbounded SELECT queries)', () => {
        it('flags an unbounded SELECT query without WHERE or LIMIT as Full Table Scan with Minor severity', () => {
            const queries = [createSelectQuery('customers')];

            const warnings = checkFullTableScans(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('Full Table Scan');
            expect(warnings[0].severity.level).toBe(1);
            expect(warnings[0].severity.name).toBe('Minor');
            expect(warnings[0].message).toBe(
                "An unbounded query (possible full table scan) was executed on table 'customers'."
            );
        });

        it('flags each unbounded SELECT in a batch', () => {
            const queries = [
                createSelectQuery('users', undefined, 'SELECT * FROM users;', 1),
                createSelectQuery('orders', undefined, 'SELECT id, amount FROM orders;', 2)
            ];

            const warnings = checkFullTableScans(queries);

            expect(warnings).toHaveLength(2);
            expect(warnings[0].message).toContain("'users'");
            expect(warnings[1].message).toContain("'orders'");
        });
    });

    describe('Negative cases (bounded queries)', () => {
        it('returns no warnings when query has a WHERE filter', () => {
            const queries = [createSelectQuery('users', 'id = 42')];

            const warnings = checkFullTableScans(queries);
            expect(warnings).toHaveLength(0);
        });

        it('returns no warnings when query uses LIMIT clause', () => {
            const queries = [
                createSelectQuery('products', undefined, 'SELECT * FROM products LIMIT 50;', 1),
                createSelectQuery('logs', undefined, 'select * from logs limit 10;', 2)
            ];

            const warnings = checkFullTableScans(queries);
            expect(warnings).toHaveLength(0);
        });

        it('returns no warnings when query uses FETCH FIRST / FETCH NEXT pagination', () => {
            const queries = [
                createSelectQuery('items', undefined, 'SELECT * FROM items FETCH FIRST 10 ROWS ONLY;', 1),
                createSelectQuery('items', undefined, 'SELECT * FROM items OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY;', 2)
            ];

            const warnings = checkFullTableScans(queries);
            expect(warnings).toHaveLength(0);
        });

        it('returns no warnings when query uses TOP N or TOP (N) syntax', () => {
            const queries = [
                createSelectQuery('reports', undefined, 'SELECT TOP 100 * FROM reports;', 1),
                createSelectQuery('reports', undefined, 'SELECT TOP (50) * FROM reports;', 2)
            ];

            const warnings = checkFullTableScans(queries);
            expect(warnings).toHaveLength(0);
        });
    });

    describe('Boundary cases', () => {
        it('returns empty array when input is empty', () => {
            expect(checkFullTableScans([])).toEqual([]);
        });

        it('treats whitespace-only WHERE clause as missing filter', () => {
            const queries = [
                createSelectQuery('accounts', '   ', 'SELECT * FROM accounts;', 1),
                createSelectQuery('transactions', '', 'SELECT * FROM transactions;', 2)
            ];

            const warnings = checkFullTableScans(queries);
            expect(warnings).toHaveLength(2);
        });

        it('handles mixed bounded and unbounded queries accurately', () => {
            const queries = [
                createSelectQuery('users', 'active = true', undefined, 1),
                createSelectQuery('analytics_events', undefined, 'SELECT * FROM analytics_events;', 2),
                createSelectQuery('logs', undefined, 'SELECT * FROM logs LIMIT 100;', 3)
            ];

            const warnings = checkFullTableScans(queries);
            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toContain("'analytics_events'");
        });
    });

    describe('Legitimate SQL patterns & prevention of false positives', () => {
        it('does not falsely flag case-variant limit syntax', () => {
            const queries = [
                createSelectQuery('t1', undefined, 'SELECT * FROM t1 Limit 10;', 1),
                createSelectQuery('t2', undefined, 'SELECT * FROM t2 LiMiT 10;', 2)
            ];

            const warnings = checkFullTableScans(queries);
            expect(warnings).toHaveLength(0);
        });

        it('does not falsely flag ANSI/Oracle pagination with FETCH NEXT and OFFSET', () => {
            const query = createSelectQuery(
                'catalog',
                undefined,
                'SELECT id, name FROM catalog ORDER BY name OFFSET 50 ROWS FETCH NEXT 25 ROWS ONLY;',
                1
            );

            const warnings = checkFullTableScans([query]);
            expect(warnings).toHaveLength(0);
        });
    });
});
