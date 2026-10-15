
export const presets = {
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
        "2026-10-15T14:22:01.170+02:00 DEBUG 38410 --- [nio-8080-exec-1] org.hibernate.SQL : select o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount, o1_0.user_id from orders o1_0 where o1_0.user_id=?"
    ,

    cleanBatch:
        "2026-10-15T14:30:10.105+02:00 DEBUG 38410 --- [nio-8080-exec-2] org.hibernate.SQL : select u1_0.id, u1_0.email, u1_0.username from users u1_0 where u1_0.status=?\n" +
        "2026-10-15T14:30:10.108+02:00 TRACE 38410 --- [nio-8080-exec-2] org.hibernate.orm.jdbc.bind : binding parameter (1:VARCHAR) <- [ACTIVE]\n" +
        "Hibernate: select o1_0.user_id, o1_0.id, o1_0.created_at, o1_0.status, o1_0.total_amount from orders o1_0 where o1_0.user_id in (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
};




