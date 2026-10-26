import { describe, it, expect } from 'vitest';
import { checkMutationWithoutFilter } from './mutationWithoutFilter.ts';
import type { DeleteQuery, UpdateQuery } from '../utils/sql-types.ts';

function createUpdateQuery(table: string, where?: string, raw?: string, id: number = 1): UpdateQuery {
    return {
        id,
        type: 'update',
        table,
        where,
        raw: raw ?? (where ? `UPDATE ${table} SET col = 1 WHERE ${where};` : `UPDATE ${table} SET col = 1;`)
    };
}

function createDeleteQuery(table: string, where?: string, raw?: string, id: number = 1): DeleteQuery {
    return {
        id,
        type: 'delete',
        table,
        where,
        raw: raw ?? (where ? `DELETE FROM ${table} WHERE ${where};` : `DELETE FROM ${table};`)
    };
}

describe('checkMutationWithoutFilter', () => {
    describe('Positive cases (dangerous statements detection)', () => {
        it('flags an UPDATE without WHERE clause as Dangerous Statement with Critical severity', () => {
            const queries = [createUpdateQuery('users', undefined)];

            const warnings = checkMutationWithoutFilter(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('Dangerous Statement');
            expect(warnings[0].severity.level).toBe(3);
            expect(warnings[0].severity.name).toBe('Critical');
            expect(warnings[0].message).toBe('Statement without WHERE clause: UPDATE users SET col = 1;');
        });

        it('flags a DELETE without WHERE clause as Dangerous Statement with Critical severity', () => {
            const queries = [createDeleteQuery('orders', undefined)];

            const warnings = checkMutationWithoutFilter(queries);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('Dangerous Statement');
            expect(warnings[0].severity.level).toBe(3);
            expect(warnings[0].severity.name).toBe('Critical');
            expect(warnings[0].message).toBe('Statement without WHERE clause: DELETE FROM orders;');
        });

        it('flags multiple unbounded mutations individually', () => {
            const queries = [
                createUpdateQuery('products', undefined, 'UPDATE products SET price = 0;', 1),
                createDeleteQuery('sessions', undefined, 'DELETE FROM sessions;', 2)
            ];

            const warnings = checkMutationWithoutFilter(queries);

            expect(warnings).toHaveLength(2);
            expect(warnings[0].message).toContain('UPDATE products SET price = 0;');
            expect(warnings[1].message).toContain('DELETE FROM sessions;');
        });
    });

    describe('Negative cases (safe queries with WHERE clause)', () => {
        it('returns no warnings for UPDATE or DELETE with a simple WHERE clause', () => {
            const queries = [
                createUpdateQuery('users', 'id = 42', undefined, 1),
                createDeleteQuery('sessions', 'expired_at < NOW()', undefined, 2)
            ];

            const warnings = checkMutationWithoutFilter(queries);
            expect(warnings).toHaveLength(0);
        });

        it('returns no warnings for queries with complex WHERE clauses (IN list, subquery, conjunctions)', () => {
            const queries = [
                createUpdateQuery('orders', 'customer_id IN (1, 2, 3) AND status = ?', undefined, 1),
                createDeleteQuery('tokens', 'user_id IN (SELECT id FROM blocked_users)', undefined, 2)
            ];

            const warnings = checkMutationWithoutFilter(queries);
            expect(warnings).toHaveLength(0);
        });

        it('recognizes intentional filter WHERE 1=1 as valid filter', () => {
            const queries = [createDeleteQuery('temp_data', '1 = 1')];

            const warnings = checkMutationWithoutFilter(queries);
            expect(warnings).toHaveLength(0);
        });
    });

    describe('Boundary cases', () => {
        it('returns empty array when input list is empty', () => {
            expect(checkMutationWithoutFilter([])).toEqual([]);
        });

        it('treats whitespace-only WHERE clause as missing filter', () => {
            const queries = [
                createUpdateQuery('users', '   ', 'UPDATE users SET active = 1;', 1),
                createDeleteQuery('logs', '', 'DELETE FROM logs;', 2)
            ];

            const warnings = checkMutationWithoutFilter(queries);
            expect(warnings).toHaveLength(2);
        });

        it('correctly filters mixed batches of safe and dangerous queries', () => {
            const queries = [
                createUpdateQuery('users', 'id = 1', undefined, 1),
                createDeleteQuery('temp_cache', undefined, 'DELETE FROM temp_cache;', 2),
                createUpdateQuery('orders', 'status = ?', undefined, 3)
            ];

            const warnings = checkMutationWithoutFilter(queries);
            expect(warnings).toHaveLength(1);
            expect(warnings[0].message).toContain('DELETE FROM temp_cache;');
        });
    });

    describe('Legitimate SQL patterns & prevention of false negatives/positives', () => {
        it('does not get tricked by the word "where" inside single-quoted string literals', () => {
            // A statement without WHERE clause updating a title column to "where is waldo"
            const query = createUpdateQuery(
                'articles',
                undefined,
                "UPDATE articles SET title = 'Where is waldo?';",
                1
            );

            const warnings = checkMutationWithoutFilter([query]);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('Dangerous Statement');
            expect(warnings[0].message).toContain("UPDATE articles SET title = 'Where is waldo?';");
        });

        it('does not get tricked by the word "where" inside comments', () => {
            const query = createDeleteQuery(
                'logs',
                undefined,
                'DELETE FROM logs; -- where id = 99',
                1
            );

            const warnings = checkMutationWithoutFilter([query]);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('Dangerous Statement');
        });

        it('correctly recognizes fallback WHERE in raw string when where property is undefined', () => {
            const query: UpdateQuery = {
                id: 1,
                type: 'update',
                table: 'users',
                raw: 'UPDATE users SET status = 1 WHERE id = 10;'
            };

            const warnings = checkMutationWithoutFilter([query]);
            expect(warnings).toHaveLength(0);
        });

        it('handles identifiers containing the substring "where" without false positive', () => {
            const query = createUpdateQuery(
                'locations',
                'id = 5',
                'UPDATE locations SET nowhere = 1, somewhere = 2 WHERE id = 5;',
                1
            );

            const warnings = checkMutationWithoutFilter([query]);
            expect(warnings).toHaveLength(0);
        });
    });
});
