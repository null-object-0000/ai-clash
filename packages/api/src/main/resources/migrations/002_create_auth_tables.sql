CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  display_name VARCHAR(100) NULL,
  avatar_url VARCHAR(500) NULL,
  primary_email_id BIGINT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,
  INDEX idx_status (status),
  INDEX idx_primary_email_id (primary_email_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_emails (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  email VARCHAR(320) NOT NULL,
  normalized_email VARCHAR(320) NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  source VARCHAR(32) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME NULL,
  UNIQUE KEY uq_normalized_email (normalized_email),
  UNIQUE KEY uq_user_email (user_id, normalized_email),
  INDEX idx_user_id (user_id),
  CONSTRAINT fk_user_emails_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_identities (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  provider VARCHAR(32) NOT NULL,
  provider_user_id VARCHAR(128) NOT NULL,
  provider_login VARCHAR(128) NULL,
  provider_email VARCHAR(320) NULL,
  provider_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  profile JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,
  UNIQUE KEY uq_provider_user (provider, provider_user_id),
  INDEX idx_user_id (user_id),
  CONSTRAINT fk_user_identities_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  CONSTRAINT fk_auth_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_states (
  id CHAR(64) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  return_to VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
