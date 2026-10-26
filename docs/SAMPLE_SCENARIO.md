# Realistisches Beispielszenario: E-Commerce Checkout & Order Processing Incident 🛒

Dieses Dokument beschreibt ein praxisnahes Beispielszenario, wie es typischerweise in Enterprise-Anwendungen auf Basis von **Spring Boot, Spring Data JPA und Hibernate** auftritt. 

Das Szenario ist direkt in der Web-Applikation über den Preset-Button **"Load E-Commerce Incident (Multi-Issue)"** verfügbar und kann mit einem Klick analysiert werden.

---

## 1. Szenario-Kontext

Im Rahmen eines Spring-Boot-Microservices (`Order-Service`) wird ein HTTP-Endpunkt für die Auftragsabwicklung und Bestellübersicht aufgerufen:
`GET /api/v1/customers/recent-orders` bzw. `POST /api/v1/orders/checkout`.

Im Code passieren fünf scheinbar harmlose Aktionen:
1. **Kundendaten laden**: Das Repository lädt Kunden ohne explizites Paging oder Filter.
2. **Bestellungen traversieren**: Eine Schleife iteriert über die Kunden und greift auf `customer.getOrders()` zu. Da die Beziehung standardmäßig `FetchType.LAZY` ist, feuert Hibernate für jeden Kunden eine separate SQL-Abfrage ab.
3. **Bestellpositionen serialisieren**: Für jede Bestellung greift der Jackson-JSON-Serializer auf `order.getOrderItems()` zu – erneut lazy geladen.
4. **Lagerbestand reduzieren**: Der Service aktualisiert den Lagerbestand pro bestelltem Artikel in einer Einzelschleife (`inventory.setStockCount(...)`).
5. **Audit-Logging schreiben**: Bei jeder Statusänderung wird ein einzelnes Audit-Event in die Datenbank geschrieben (`auditRepository.save(new AuditEvent(...))`).

---

## 2. Der problematische SQL-Log-Auszug

Auszug aus den Produktions-Logs (`application.log` mit aktiviertem Hibernate SQL-Logging):

```log
2026-10-26T14:02:10.120+01:00 DEBUG 14208 --- [nio-8080-exec-4] org.hibernate.SQL : select c1_0.id, c1_0.email, c1_0.full_name, c1_0.status from customers c1_0
Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?
2026-10-26T14:02:10.135+01:00 DEBUG 14208 --- [nio-8080-exec-4] org.hibernate.SQL : select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?
Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?
Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?
Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?
Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?
Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?
Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?
Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?
Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?
Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?
Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?
Hibernate: update inventory set stock_count=?, reserved_count=? where product_id=?
Hibernate: update inventory set stock_count=?, reserved_count=? where product_id=?
Hibernate: update inventory set stock_count=?, reserved_count=? where product_id=?
Hibernate: update inventory set stock_count=?, reserved_count=? where product_id=?
2026-10-26T14:02:10.290+01:00 DEBUG 14208 --- [nio-8080-exec-4] org.hibernate.SQL : insert into audit_events (action, entity_id, user_id, timestamp) values (?, ?, ?, ?)
Hibernate: insert into audit_events (action, entity_id, user_id, timestamp) values (?, ?, ?, ?)
Hibernate: insert into audit_events (action, entity_id, user_id, timestamp) values (?, ?, ?, ?)
Hibernate: insert into audit_events (action, entity_id, user_id, timestamp) values (?, ?, ?, ?)
```

---

## 3. Was der SQL Analyzer sofort erkennt

Wird dieser Log-Ausschnitt in den **SQL Analyzer** eingefügt, deckt die statische Heuristik-Engine unmittelbar **6 kritische Anti-Patterns** auf:

| Erkanntes Problem | Betroffene Tabelle | Schweregrad (Severity) | Heuristisches Kriterium |
|---|---|---|---|
| **N+1 Query Bottleneck** | `orders` | **Moderate** (Level 2) | 6 identische `SELECT`-Queries mit parametrisiertem `WHERE customer_id=?` |
| **N+1 Query Bottleneck** | `order_items` | **Moderate** (Level 2) | 6 identische `SELECT`-Queries mit parametrisiertem `WHERE order_id=?` |
| **Iterative Single-Record Updates** | `inventory` | **Minor** (Level 1) | 4 aufeinanderfolgende `UPDATE`-Queries mit identischer `WHERE product_id=?`-Struktur |
| **Missing Batching on INSERT** | `audit_events` | **Minor** (Level 1) | 4 einzelne `INSERT`-Statements statt Multi-Row- oder JDBC-Batching |
| **Full Table Scan / Unbounded Query** | `customers` | **Minor** (Level 1) | `SELECT` ohne `WHERE`-Filter und ohne Begrenzung (`LIMIT` / `FETCH FIRST`) |
| **Excessive Overall Query Count** | *Global* | **Minor** (Level 1) | 21 Datenbankabfragen innerhalb einer einzigen Request-Transaktion |

### Tabellarische CRUD-Übersicht im Tool:

| Tabelle | SELECT | INSERT | UPDATE | DELETE | Gesamt |
|---|---|---|---|---|---|
| `customers` | 1 | 0 | 0 | 0 | 1 |
| `orders` | 6 | 0 | 0 | 0 | 6 |
| `order_items` | 6 | 0 | 0 | 0 | 6 |
| `inventory` | 0 | 0 | 4 | 0 | 4 |
| `audit_events` | 0 | 4 | 0 | 0 | 4 |
| **Summe** | **13** | **4** | **4** | **0** | **21** |

---

## 4. Warum dieses Verhalten in Produktion fatal ist

In der lokalen Entwicklungsumgebung (z. B. H2 In-Memory-Datenbank mit 3 Testkunden) fällt dieser Ablauf kaum auf: Die 21 Abfragen benötigen zusammengerechnet nur 3 ms.

In Produktion mit 500 aktiven Kunden eskaliert das Verhalten exponentiell:
1. **Kaskadierende N+1-Explosion**: 1 Kundenabfrage $\to$ 500 Abfragen für Bestellungen $\to$ 2.500 Abfragen für Bestellpositionen = **3.001 Abfragen pro HTTP-Request!**
2. **Netzwerk-Latenz**: Selbst bei minimalen 1 ms Ping zwischen Application-Server und DB summiert sich die reine Idle-Wartezeit auf **3 Sekunden**.
3. **HikariCP Connection Pool Exhaustion**: Bei 20 gleichzeitigen Benutzern blockieren 60.000 SQL-Aufrufe sämtliche Datenbankverbindungen. Folge: HTTP 500, Request Timeouts und Serverausfall.
4. **Fehlendes Batching**: Das Schreiben von Audit-Logs und Lager-Updates ohne Batching erzeugt unnötige TCP-Pakete und verhindert effizientes Schreiben auf die DB-Transaktions-Logs (WAL/Redo Log).

---

## 5. Behebung und Best Practices

### 1. N+1 beheben mit `@EntityGraph` oder `JOIN FETCH`
Statt Lazy-Loading in Schleifen:
```java
@Query("SELECT c FROM Customer c JOIN FETCH c.orders o JOIN FETCH o.orderItems WHERE c.status = :status")
List<Customer> findRecentCustomersWithOrders(@Param("status") CustomerStatus status);
```
Oder Aktivierung von Batch-Fetching in `application.yml`:
```yaml
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 25
```

### 2. JDBC Batching für INSERTs aktivieren
In `application.yml`:
```yaml
spring:
  jpa:
    properties:
      hibernate:
        jdbc:
          batch_size: 50
          order_inserts: true
          order_updates: true
```

### 3. Bulk-Update für Inventar
Statt individueller `save()`-Aufrufe in Java:
```java
@Modifying
@Query("UPDATE Inventory i SET i.stockCount = i.stockCount - :qty WHERE i.product.id = :productId")
void decrementStock(@Param("productId") Long productId, @Param("qty") int qty);
```

### 4. Paging für Kunden
Niemals unbegrenzt abfragen:
```java
Page<Customer> findByStatus(CustomerStatus status, Pageable pageable);
```

---

## 6. Fazit

Dieses Szenario demonstriert anschaulich die Kernstärke des **SQL Analyzers**: 
Innerhalb von Sekunden verwandelt das Tool unübersichtliche, verschachtelte Hibernate-Logs in eine transparente Diagnose mit konkreten Hinweisen zur Leistungsoptimierung.
