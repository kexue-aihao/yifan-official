CREATE TABLE IF NOT EXISTS post_media (
 post_id VARCHAR(36) PRIMARY KEY, images TEXT NOT NULL,
 FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS post_sources (
 post_id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36), ip VARCHAR(45) NOT NULL,
 fingerprint CHAR(64) NOT NULL, fingerprint_version VARCHAR(32) NOT NULL,
 fingerprint_quality VARCHAR(24) NOT NULL, browser_signals TEXT NOT NULL,
 user_agent VARCHAR(1000) NOT NULL, accept_language VARCHAR(300) NOT NULL,
 client_hints VARCHAR(500) NOT NULL, location TEXT NOT NULL,
 content_hash CHAR(64) NOT NULL, created_at BIGINT NOT NULL,
 INDEX post_source_user(user_id,created_at), INDEX post_source_ip(ip,created_at),
 INDEX post_source_fingerprint(fingerprint,created_at), INDEX post_source_expiry(created_at),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
