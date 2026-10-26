import { describe, it, expect } from 'vitest';
import { parseLogToGroupedQueries, InputNotValidError } from './parser.ts';

describe('parseLogToGroupedQueries', () => {
    it('parses a single SELECT statement correctly', () => {
        const sql = 'SELECT * FROM users WHERE id = 1;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select).toHaveLength(1);
        expect(result.select[0].table).toBe('users');
        expect(result.select[0].type).toBe('select');
        expect(result.insert).toHaveLength(0);
        expect(result.update).toHaveLength(0);
        expect(result.delete).toHaveLength(0);
    });

    it('parses and strips Hibernate log prefixes', () => {
        const log = `
            2026-03-29 10:15:30.123 DEBUG org.hibernate.SQL : select * from orders where customer_id = 42;
            Hibernate: insert into audit_log (action) values ('LOGIN');
        `;
        const result = parseLogToGroupedQueries(log);

        expect(result.select).toHaveLength(1);
        expect(result.select[0].table).toBe('orders');
        expect(result.insert).toHaveLength(1);
        expect(result.insert[0].table).toBe('audit_log');
    });

    it('groups different query types into their respective collections', () => {
        const sql = `
            SELECT id FROM customers;
            INSERT INTO customers (name) VALUES ('Alice');
            UPDATE customers SET name = 'Bob' WHERE id = 1;
            DELETE FROM customers WHERE id = 2;
        `;
        const result = parseLogToGroupedQueries(sql);

        expect(result.select).toHaveLength(1);
        expect(result.insert).toHaveLength(1);
        expect(result.update).toHaveLength(1);
        expect(result.delete).toHaveLength(1);
    });

    it('throws InputNotValidError when input is empty or contains no query', () => {
        expect(() => parseLogToGroupedQueries('')).toThrow(InputNotValidError);
        expect(() => parseLogToGroupedQueries('   ')).toThrow(InputNotValidError);
    });
});
