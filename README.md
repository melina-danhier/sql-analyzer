# SQL Analyzer 🔍

[![CI](https://github.com/melina-danhier/sql-analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/melina-danhier/sql-analyzer/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/melina-danhier/sql-analyzer/actions/workflows/deploy.yml/badge.svg)](https://github.com/melina-danhier/sql-analyzer/actions/workflows/deploy.yml)
[![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live_Demo-2ea44f?style=for-the-badge&logo=github&logoColor=white)](https://melina-danhier.github.io/sql-analyzer/)

A lightweight, client-side web application to inspect, analyze, and detect performance bottlenecks and dangerous queries in SQL and Hibernate logs.

🔗 **Live Demo:** [https://melina-danhier.github.io/sql-analyzer/](https://melina-danhier.github.io/sql-analyzer/)

![SQL Analyzer Preview](./screenshot.png)

---

## ⚠️ Problem Analysis: Why N+1 Queries in JPA/Hibernate Are Dangerous

The **N+1 query problem** is one of the most common and critical performance bottlenecks in enterprise applications relying on ORM frameworks like **Hibernate** and **Spring Data JPA**.

### How the Problem Arises
1. **1 Initial Query**: The application retrieves a collection of $N$ parent entities (e.g., 100 users):
   ```sql
   SELECT * FROM users;
   ```
2. **N Additional Queries**: Accessing a lazily loaded association (e.g., calling `user.getOrders()` inside a loop or during JSON serialization) triggers Hibernate to execute an additional query for *each individual record*:
   ```sql
   SELECT * FROM orders WHERE user_id = ?; -- executed 100 times!
   ```
Instead of a single coordinated `JOIN` query, the application suddenly fires **$1 + 100 = 101$ database queries**.

### Why It Is Fatal in Production
- **The "Silent Killer" in Development**: With only 3–5 sample records in local databases, 4–6 fast queries take just a few milliseconds and go unnoticed. Under production load with thousands of records, the query count explodes instantly.
- **Latency from Network Round-Trips**: Even with a low 1 ms ping between application server and database, 1,000 individual queries add at least one full second of pure idle network waiting time per HTTP request.
- **Connection Pool Exhaustion (HikariCP)**: Hundreds of rapid consecutive queries saturate database connections. Under concurrent user traffic, this quickly leads to connection timeouts and cascading system downtime.
- **Database Overhead**: Parsing, planning, and executing hundreds of small statements wastes significant CPU and I/O capacity on the database server.

### How to Resolve N+1 Issues
- Use **`JOIN FETCH`** in JPQL / HQL queries
- Define **Entity Graphs** (`@EntityGraph`)
- Enable **Batch Fetching** via `@BatchSize(size = ...)` or `hibernate.default_batch_fetch_size`
- Employ **DTO Projections** for read-only use cases

---

## ✨ Features

- **Automated Log Parsing**:
  - Supports raw SQL logs as well as Spring Boot / Hibernate logs (both single-line and formatted multi-line logs with `format_sql=true`).
  - Automatically strips log metadata prefixes (timestamps, thread identifiers, `Hibernate:`, `org.hibernate.SQL`).

- **Performance & Anti-Pattern Detection**:
  - **N+1 Query Detection**: Identifies repeated `SELECT` statements executed against the same table with matching `WHERE` filter structures.
  - **Dangerous Statements**: Highlights high-risk `UPDATE` and `DELETE` operations executed without a `WHERE` clause.
  - **Missing Batching**: Flags loops of individual `INSERT` statements that should be batched together.
  - **Iterative Updates**: Detects repetitive single-record updates with normalized filter structures.
  - **Full Table Scans / Unbounded Queries**: Warns about unbounded `SELECT` queries missing `WHERE` filters or `LIMIT` clauses.
  - **Query Count Warning**: Alerts when overall query traffic exceeds safe thresholds.

- **Breakdown by Table**:
  - Clear summary matrix categorizing CRUD operations (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) per database table.

- **Presets**:
  - Quick-load realistic sample scenarios (*Hibernate N+1 Scenario*, *Clean Batch Query*) to test immediately.

- **Export & Copy**:
  - One-click button to export the full analysis summary formatted as clean, Markdown-ready text.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Testing**: [Vitest](https://vitest.dev/) & [React Testing Library](https://testing-library.com/)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (version 18+ recommended) installed.

### Installation

1. Clone or download the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Development Server

```bash
npm run dev
```
Open the URL printed in the terminal (usually `http://localhost:5173`).

### Code Quality & Verification Commands

All quality gates run automatically in CI on every Pull Request and push to `main`. You can run each check individually or together locally:

| Command | Tool | Purpose |
|---|---|---|
| `npm run lint` | ESLint | Checks code style, React hooks rules, and imports |
| `npm run typecheck` | TypeScript compiler (`tsc`) | Validates types without emitting files |
| `npm test` | Vitest & React Testing Library | Executes unit and component tests |
| `npm run test:watch` | Vitest | Runs tests continuously during development |
| `npm run build` | Vite + TypeScript | Type-checks and creates the production bundle in `dist/` |

#### Run All Checks Locally
To verify your changes before pushing or opening a PR:
```bash
npm run lint && npm run typecheck && npm test && npm run build
```

---

## 🤖 Continuous Integration & Deployment (CI/CD)

The project leverages automated GitHub Actions workflows to guarantee code quality and safe releases:

1. **Continuous Integration (`.github/workflows/ci.yml`)**:
   - Triggers on every **Pull Request** and **Push** targeting `main`, as well as manual dispatches.
   - Enforces a clean pipeline executing **ESLint**, **TypeScript type checking**, **Vitest test suite**, and **Production build**.
   - Prevents regressions and failing code from entering the default branch.

2. **Automated Deployment (`.github/workflows/deploy.yml`)**:
   - Triggers on pushes to `main`.
   - Re-verifies all quality checks (ESLint, Type Check, Tests, Build).
   - Only publishes the build artifact to **GitHub Pages** if all quality gates pass successfully.

---

## 📄 License

MIT
