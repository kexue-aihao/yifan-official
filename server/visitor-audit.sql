CREATE TABLE IF NOT EXISTS visitor_ips (
 ip VARCHAR(45) PRIMARY KEY, country VARCHAR(8) NOT NULL, region VARCHAR(120) NOT NULL,
 city VARCHAR(120) NOT NULL, geo_status VARCHAR(20) NOT NULL, source VARCHAR(80) NOT NULL, resolved_at BIGINT NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS visitor_events (
 id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36), ip VARCHAR(45) NOT NULL,
 kind VARCHAR(24) NOT NULL, path VARCHAR(256) NOT NULL DEFAULT '',
 booking_id VARCHAR(36), conversation_id VARCHAR(36), message_id VARCHAR(36), created_at BIGINT NOT NULL,
 INDEX visitor_ip_time(ip,created_at), INDEX visitor_user_time(user_id,created_at),
 INDEX visitor_booking(booking_id), INDEX visitor_conversation(conversation_id), INDEX visitor_expiry(created_at),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
 FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
 FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
 FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE SET NULL
) ENGINE=InnoDB;
