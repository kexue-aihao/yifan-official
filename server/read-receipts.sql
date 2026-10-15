CREATE TABLE IF NOT EXISTS booking_staff_views (
 booking_id VARCHAR(36) PRIMARY KEY, staff_id VARCHAR(36) NOT NULL, viewed_at BIGINT NOT NULL,
 FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
 FOREIGN KEY(staff_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS message_staff_reads (
 message_id VARCHAR(36) PRIMARY KEY, staff_id VARCHAR(36) NOT NULL, read_at BIGINT NOT NULL,
 FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
 FOREIGN KEY(staff_id) REFERENCES users(id)
) ENGINE=InnoDB;
