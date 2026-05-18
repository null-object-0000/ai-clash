ALTER TABLE share_snapshots
  ADD COLUMN owner_user_id BIGINT NULL,
  ADD INDEX idx_owner_user_id (owner_user_id);
