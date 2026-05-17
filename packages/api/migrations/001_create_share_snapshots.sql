CREATE TABLE IF NOT EXISTS share_snapshots (
  id VARCHAR(32) PRIMARY KEY,
  schema_version INT NOT NULL DEFAULT 1,
  snapshot_hash CHAR(64) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  deleted_at DATETIME NULL,
  delete_token_hash CHAR(64) NULL,
  view_count BIGINT NOT NULL DEFAULT 0,
  INDEX idx_snapshot_hash (snapshot_hash),
  INDEX idx_created_at (created_at),
  INDEX idx_expires_at (expires_at),
  INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
