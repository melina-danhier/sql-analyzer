export const presets = {
    ecommerceIncident:
        "2026-10-26T14:02:10.120+01:00 DEBUG 14208 --- [nio-8080-exec-4] org.hibernate.SQL : select c1_0.id, c1_0.email, c1_0.full_name, c1_0.status from customers c1_0\n" +
        "Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?\n" +
        "2026-10-26T14:02:10.135+01:00 DEBUG 14208 --- [nio-8080-exec-4] org.hibernate.SQL : select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?\n" +
        "Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?\n" +
        "Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?\n" +
        "Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?\n" +
        "Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.customer_id from orders o1_0 where o1_0.customer_id=?\n" +
        "Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?\n" +
        "Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?\n" +
        "Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?\n" +
        "Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?\n" +
        "Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?\n" +
        "Hibernate: select oi1_0.id, oi1_0.order_id, oi1_0.product_id, oi1_0.quantity, oi1_0.price from order_items oi1_0 where oi1_0.order_id=?\n" +
        "Hibernate: update inventory set stock_count=?, reserved_count=? where product_id=?\n" +
        "Hibernate: update inventory set stock_count=?, reserved_count=? where product_id=?\n" +
        "Hibernate: update inventory set stock_count=?, reserved_count=? where product_id=?\n" +
        "Hibernate: update inventory set stock_count=?, reserved_count=? where product_id=?\n" +
        "2026-10-26T14:02:10.290+01:00 DEBUG 14208 --- [nio-8080-exec-4] org.hibernate.SQL : insert into audit_events (action, entity_id, user_id, timestamp) values (?, ?, ?, ?)\n" +
        "Hibernate: insert into audit_events (action, entity_id, user_id, timestamp) values (?, ?, ?, ?)\n" +
        "Hibernate: insert into audit_events (action, entity_id, user_id, timestamp) values (?, ?, ?, ?)\n" +
        "Hibernate: insert into audit_events (action, entity_id, user_id, timestamp) values (?, ?, ?, ?)",

    hibernateNPlusOne:
        "2026-10-15T14:22:01.102+02:00 DEBUG 38410 --- [nio-8080-exec-1] org.hibernate.SQL : select u1_0.id, u1_0.email, u1_0.username from users u1_0\n" +
        "Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.user_id from orders o1_0 where o1_0.user_id=?\n" +
        "2026-10-15T14:22:01.115+02:00 DEBUG 38410 --- [nio-8080-exec-1] org.hibernate.SQL : select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.user_id from orders o1_0 where o1_0.user_id=?\n" +
        "Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.user_id from orders o1_0 where o1_0.user_id=?\n" +
        "2026-10-15T14:22:01.128+02:00 DEBUG 38410 --- [nio-8080-exec-1] org.hibernate.SQL : select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.user_id from orders o1_0 where o1_0.user_id=?\n" +
        "Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.user_id from orders o1_0 where o1_0.user_id=?\n" +
        "2026-10-15T14:22:01.140+02:00 DEBUG 38410 --- [nio-8080-exec-1] org.hibernate.SQL : select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.user_id from orders o1_0 where o1_0.user_id=?\n" +
        "Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.user_id from orders o1_0 where o1_0.user_id=?\n" +
        "2026-10-15T14:22:01.155+02:00 DEBUG 38410 --- [nio-8080-exec-1] org.hibernate.SQL : select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.user_id from orders o1_0 where o1_0.user_id=?\n" +
        "Hibernate: select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.user_id from orders o1_0 where o1_0.user_id=?\n" +
        "2026-10-15T14:22:01.170+02:00 DEBUG 38410 --- [nio-8080-exec-1] org.hibernate.SQL : select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.user_id from orders o1_0 where o1_0.user_id=?",

    cleanBatch:
        "2026-10-15T14:30:10.105+02:00 DEBUG 38410 --- [nio-8080-exec-2] org.hibernate.SQL : select u1_0.id, u1_0.email, u1_0.username from users u1_0 where u1_0.status=?\n" +
        "2026-10-15T14:30:10.108+02:00 TRACE 38410 --- [nio-8080-exec-2] org.hibernate.orm.jdbc.bind : binding parameter (1:VARCHAR) <- [ACTIVE]\n" +
        "Hibernate: select o1_0.user_id, o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount from orders o1_0 where o1_0.user_id in (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
};
