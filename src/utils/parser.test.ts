import { describe, it, expect } from 'vitest';
import {
    parseLogToGroupedQueries,
    InputNotValidError,
    stripComments,
    splitStatements,
    cleanIdentifier,
    extractTable,
    extractWhereClause,
    hasParameter,
    stripHibernatePrefix,
    extractStatements,
    parseStatement
} from './parser.ts';
import { presets } from './presets.ts';

describe('parseLogToGroupedQueries - baseline tests', () => {
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

describe('Comments & Semicolons inside Strings (Regression & Robustness)', () => {
    it('does not split statement on semicolon inside single-quoted strings', () => {
        const sql = "INSERT INTO logs (message) VALUES ('Error; user not found; aborting');";
        const result = parseLogToGroupedQueries(sql);

        expect(result.insert).toHaveLength(1);
        expect(result.insert[0].table).toBe('logs');
    });

    it('handles multiple statements with semicolons inside strings correctly', () => {
        const sql = `
            INSERT INTO logs (msg) VALUES ('first; value');
            SELECT * FROM users WHERE note = 'foo; bar';
        `;
        const result = parseLogToGroupedQueries(sql);

        expect(result.insert).toHaveLength(1);
        expect(result.insert[0].table).toBe('logs');
        expect(result.select).toHaveLength(1);
        expect(result.select[0].table).toBe('users');
        expect(result.select[0].where).toBe("note = 'foo; bar'");
    });

    it('parses multiple statements written on a single line separated by semicolons', () => {
        const sql = 'SELECT * FROM users; SELECT * FROM products; DELETE FROM cart;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select).toHaveLength(2);
        expect(result.select[0].table).toBe('users');
        expect(result.select[1].table).toBe('products');
        expect(result.delete).toHaveLength(1);
        expect(result.delete[0].table).toBe('cart');
    });

    it('handles single-line (--) and block (/* */) comments without corrupting statements', () => {
        const sql = `
            -- Initial comment with semicolon;
            /* Multi-line block comment
               with semicolon; and SELECT keyword */
            SELECT u.id, u.name -- inline comment
            /* another comment */
            FROM users u
            WHERE u.active = 1; -- end of query
        `;
        const result = parseLogToGroupedQueries(sql);

        expect(result.select).toHaveLength(1);
        expect(result.select[0].table).toBe('users');
        expect(result.select[0].where).toBe('u.active = 1');
    });

    it('does not remove comment characters that appear inside string literals', () => {
        const sql = "SELECT * FROM messages WHERE body = '-- not a comment /* neither is this */';";
        const result = parseLogToGroupedQueries(sql);

        expect(result.select).toHaveLength(1);
        expect(result.select[0].where).toBe("body = '-- not a comment /* neither is this */'");
    });
});

describe('Multi-line Statements & Hibernate Formats', () => {
    it('correctly parses a multi-line formatted SQL statement', () => {
        const sql = `
            SELECT
                u.id,
                u.email,
                u.created_at
            FROM
                users u
            WHERE
                u.status = 'ACTIVE'
            ORDER BY
                u.created_at DESC
        `;
        const result = parseLogToGroupedQueries(sql);

        expect(result.select).toHaveLength(1);
        expect(result.select[0].table).toBe('users');
        expect(result.select[0].where).toBe("u.status = 'ACTIVE'");
    });

    it('parses multi-line Hibernate log where "Hibernate:" is on its own line', () => {
        const log = `
            Hibernate:
                select
                    user0_.id as id1_0_,
                    user0_.email as email2_0_
                from
                    users user0_
                where
                    user0_.id=?
            Hibernate:
                select
                    order0_.id as id1_1_
                from
                    orders order0_
        `;
        const result = parseLogToGroupedQueries(log);

        expect(result.select).toHaveLength(2);
        expect(result.select[0].table).toBe('users');
        expect(result.select[0].where).toBe('user0_.id=?');
        expect(result.select[0].isParameterQuery).toBe(true);
        expect(result.select[1].table).toBe('orders');
    });

    it('parses presets correctly including interleaved TRACE log lines', () => {
        const nPlusOneResult = parseLogToGroupedQueries(presets.hibernateNPlusOne);
        expect(nPlusOneResult.select).toHaveLength(11);
        expect(nPlusOneResult.select[0].table).toBe('users');
        expect(nPlusOneResult.select[1].table).toBe('orders');

        const cleanBatchResult = parseLogToGroupedQueries(presets.cleanBatch);
        expect(cleanBatchResult.select).toHaveLength(2);
        expect(cleanBatchResult.select[0].table).toBe('users');
        expect(cleanBatchResult.select[1].table).toBe('orders');
    });

    it('handles various Hibernate logger prefixes with colons and hyphens', () => {
        const log = `
            2026-10-15 10:00:00.123 [main] DEBUG org.hibernate.SQL: select * from table_a
            10:00:01.456 [main] DEBUG org.hibernate.SQL - select * from table_b
            SqlStatementLogger: select * from table_c
        `;
        const result = parseLogToGroupedQueries(log);

        expect(result.select).toHaveLength(3);
        expect(result.select[0].table).toBe('table_a');
        expect(result.select[1].table).toBe('table_b');
        expect(result.select[2].table).toBe('table_c');
    });
});

describe('Schema-qualified Table Names & Identifier Quoting', () => {
    it('extracts unquoted schema-qualified table names', () => {
        const sql = 'SELECT * FROM public.users u WHERE u.id = 1;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].table).toBe('public.users');
    });

    it('extracts double-quoted table and schema names', () => {
        const sql = 'SELECT * FROM "my_schema"."customers" WHERE id = 1;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].table).toBe('my_schema.customers');
    });

    it('extracts MySQL backtick-quoted identifiers', () => {
        const sql = 'SELECT * FROM `my_db`.`orders` `o` WHERE `o`.`id` = 1;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].table).toBe('my_db.orders');
    });

    it('extracts SQL Server bracketed identifiers', () => {
        const sql = 'SELECT * FROM [dbo].[accounts] WHERE [id] = 1;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].table).toBe('dbo.accounts');
    });

    it('extracts tables with three-part qualified names', () => {
        const sql = 'SELECT * FROM catalog.schema.table_name;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].table).toBe('catalog.schema.table_name');
    });

    it('handles PostgreSQL ONLY modifier', () => {
        const sql = 'SELECT * FROM ONLY "public"."users" u;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].table).toBe('public.users');
    });

    it('extracts tables across INSERT, UPDATE, and DELETE statements with aliases', () => {
        const sql = `
            INSERT INTO public.users AS u (id, name) VALUES (1, 'Test');
            UPDATE "inventory"."products" p SET p.stock = 10 WHERE p.id = 5;
            DELETE FROM [archive].[logs] AS l WHERE l.created_at < '2020-01-01';
            DELETE u FROM users u WHERE u.id = 99;
        `;
        const result = parseLogToGroupedQueries(sql);

        expect(result.insert[0].table).toBe('public.users');
        expect(result.update[0].table).toBe('inventory.products');
        expect(result.delete[0].table).toBe('archive.logs');
        expect(result.delete[1].table).toBe('users');
    });
});

describe('WHERE Clause Extraction & Subqueries', () => {
    it('stops WHERE extraction at terminating clauses (ORDER BY, GROUP BY, LIMIT, FOR UPDATE)', () => {
        const sql = `
            SELECT * FROM users
            WHERE status = 'ACTIVE' AND role = 'ADMIN'
            GROUP BY department
            ORDER BY created_at DESC
            LIMIT 10;
        `;
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].where).toBe("status = 'ACTIVE' AND role = 'ADMIN'");
    });

    it('does not truncate WHERE clause when subquery contains ORDER BY or LIMIT', () => {
        const sql = `
            SELECT * FROM users
            WHERE id IN (
                SELECT user_id FROM orders ORDER BY order_date DESC LIMIT 5
            ) AND active = 1;
        `;
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].where).toContain(
            'SELECT user_id FROM orders ORDER BY order_date DESC LIMIT 5'
        );
        expect(result.select[0].where).toMatch(/^id IN \([\s\S]+\) AND active = 1$/);
    });

    it('does not truncate WHERE clause when string literal contains keyword like ORDER BY', () => {
        const sql = "SELECT * FROM tasks WHERE description = 'ORDER BY importance' AND done = 0;";
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].where).toBe("description = 'ORDER BY importance' AND done = 0");
    });

    it('returns undefined when statement has no WHERE clause', () => {
        const sql = 'SELECT * FROM users;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].where).toBeUndefined();
    });

    it('extracts WHERE clause in UPDATE and DELETE statements with RETURNING', () => {
        const sql = `
            UPDATE accounts SET balance = balance - 100 WHERE id = 42 RETURNING balance;
            DELETE FROM sessions WHERE expired = true RETURNING id;
        `;
        const result = parseLogToGroupedQueries(sql);

        expect(result.update[0].where).toBe('id = 42');
        expect(result.delete[0].where).toBe('expired = true');
    });
});

describe('Parameter Query Detection', () => {
    it('detects JDBC positional parameter (?)', () => {
        const sql = 'SELECT * FROM users WHERE id = ?;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].isParameterQuery).toBe(true);
    });

    it('detects JPA/Hibernate named parameter (:paramName)', () => {
        const sql = 'SELECT * FROM users WHERE username = :uname AND status = :status;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].isParameterQuery).toBe(true);
    });

    it('detects PostgreSQL positional parameter ($1, $2)', () => {
        const sql = 'SELECT * FROM users WHERE id = $1 AND role = $2;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].isParameterQuery).toBe(true);
    });

    it('does NOT flag query as parameter query when ? or : is inside a string literal', () => {
        const sql = "SELECT * FROM comments WHERE content = 'Why?' AND created_at = '12:30:00';";
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].isParameterQuery).toBe(false);
    });

    it('does NOT treat PostgreSQL type cast (::type) as a named parameter', () => {
        const sql = "SELECT * FROM users WHERE id::text = '123';";
        const result = parseLogToGroupedQueries(sql);

        expect(result.select[0].isParameterQuery).toBe(false);
    });
});

describe('Invalid, Empty, and Unsupported Input Handling', () => {
    it('throws InputNotValidError for empty or whitespace-only input', () => {
        expect(() => parseLogToGroupedQueries('')).toThrow(InputNotValidError);
        expect(() => parseLogToGroupedQueries('   \n\t  ')).toThrow(InputNotValidError);
    });

    it('throws InputNotValidError for non-SQL text', () => {
        expect(() => parseLogToGroupedQueries('Hello this is a regular log message with no SQL')).toThrow(
            InputNotValidError
        );
    });

    it('throws InputNotValidError when input contains only comments', () => {
        const commentsOnly = `
            -- This is just a comment
            /* And another block comment */
        `;
        expect(() => parseLogToGroupedQueries(commentsOnly)).toThrow(InputNotValidError);
    });

    it('throws InputNotValidError when input contains only unsupported statements (e.g. DDL)', () => {
        const ddlOnly = `
            CREATE TABLE test (id INT);
            ALTER TABLE test ADD COLUMN name VARCHAR(50);
            DROP TABLE test;
        `;
        expect(() => parseLogToGroupedQueries(ddlOnly)).toThrow(InputNotValidError);
    });

    it('extracts valid DML statements when mixed with unsupported statements or log noise', () => {
        const mixed = `
            2026-10-15 10:00:00 INFO Initializing database schema
            CREATE TABLE temp_run (id INT);
            SELECT * FROM users WHERE id = 1;
            DROP TABLE temp_run;
        `;
        const result = parseLogToGroupedQueries(mixed);

        expect(result.select).toHaveLength(1);
        expect(result.select[0].table).toBe('users');
    });

    it('handles queries without a table (e.g. SELECT 1) safely without throwing', () => {
        const sql = 'SELECT 1;';
        const result = parseLogToGroupedQueries(sql);

        expect(result.select).toHaveLength(1);
        expect(result.select[0].table).toBe('unknown');
    });
});

describe('Granular Helper Function Unit Tests', () => {
    it('stripComments handles single-line, block, and string literals correctly', () => {
        expect(stripComments("SELECT 1 -- comment\n+ 2")).toBe("SELECT 1 \n+ 2");
        expect(stripComments("SELECT /* inline */ 1")).toBe("SELECT   1");
        expect(stripComments("SELECT '-- not a comment'")).toBe("SELECT '-- not a comment'");
    });

    it('splitStatements splits correctly respecting quotes', () => {
        const res = splitStatements("SELECT 1; SELECT 'a;b'; SELECT 3;");
        expect(res).toEqual(["SELECT 1", "SELECT 'a;b'", "SELECT 3"]);
    });

    it('cleanIdentifier removes quotes from single and schema-qualified names', () => {
        expect(cleanIdentifier('"users"')).toBe('users');
        expect(cleanIdentifier('`users`')).toBe('users');
        expect(cleanIdentifier('[users]')).toBe('users');
        expect(cleanIdentifier('"public"."users"')).toBe('public.users');
        expect(cleanIdentifier('`db`.`orders`')).toBe('db.orders');
        expect(cleanIdentifier('[dbo].[accounts]')).toBe('dbo.accounts');
        expect(cleanIdentifier('')).toBe('unknown');
    });

    it('extractTable extracts primary table correctly across query types', () => {
        expect(extractTable('SELECT * FROM users u', 'select')).toBe('users');
        expect(extractTable('INSERT INTO orders (id) VALUES (1)', 'insert')).toBe('orders');
        expect(extractTable('UPDATE accounts SET x = 1', 'update')).toBe('accounts');
        expect(extractTable('DELETE FROM logs WHERE id = 1', 'delete')).toBe('logs');
        expect(extractTable('DELETE logs WHERE id = 1', 'delete')).toBe('logs');
    });

    it('extractWhereClause extracts WHERE up to terminating clauses', () => {
        expect(extractWhereClause('SELECT * FROM t WHERE a = 1 ORDER BY b')).toBe('a = 1');
        expect(extractWhereClause('SELECT * FROM t WHERE a = 1;')).toBe('a = 1');
        expect(extractWhereClause('SELECT * FROM t')).toBeUndefined();
    });

    it('hasParameter accurately detects parameters', () => {
        expect(hasParameter('SELECT * FROM t WHERE a = ?')).toBe(true);
        expect(hasParameter('SELECT * FROM t WHERE a = :id')).toBe(true);
        expect(hasParameter('SELECT * FROM t WHERE a = $1')).toBe(true);
        expect(hasParameter("SELECT * FROM t WHERE a = '?'")).toBe(false);
        expect(hasParameter("SELECT * FROM t WHERE a = '12:00:00'")).toBe(false);
    });

    it('extractStatements extracts individual statement blocks', () => {
        const stmts = extractStatements('SELECT * FROM a; SELECT * FROM b;');
        expect(stmts).toHaveLength(2);
        expect(stmts[0]).toBe('SELECT * FROM a');
        expect(stmts[1]).toBe('SELECT * FROM b');
    });

    it('parseStatement builds SQLQuery object with assigned ID', () => {
        const query = parseStatement('SELECT * FROM users WHERE id = 1', 42);
        expect(query).not.toBeNull();
        expect(query?.id).toBe(42);
        expect(query?.type).toBe('select');
        expect(query?.table).toBe('users');
    });

    it('stripHibernatePrefix recognizes Hibernate and org.hibernate.SQL prefixes', () => {
        expect(stripHibernatePrefix('Hibernate: select 1').content).toBe('select 1');
        expect(stripHibernatePrefix('Hibernate: select 1').matched).toBe(true);
        expect(stripHibernatePrefix('org.hibernate.SQL : select 2').content).toBe('select 2');
        expect(stripHibernatePrefix('select 3').matched).toBe(false);
    });
});
