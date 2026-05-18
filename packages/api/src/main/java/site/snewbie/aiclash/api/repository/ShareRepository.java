package site.snewbie.aiclash.api.repository;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import site.snewbie.aiclash.api.model.ShareRecord;
import site.snewbie.aiclash.api.model.ShareToken;

import java.sql.Timestamp;

@Repository
public class ShareRepository {
  private final JdbcTemplate jdbcTemplate;

  public ShareRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public ShareRecord findBySnapshotHash(String snapshotHash) {
    try {
      return jdbcTemplate.queryForObject("""
          SELECT id, deleted_at
            FROM share_snapshots
           WHERE snapshot_hash = ?
           ORDER BY created_at ASC
           LIMIT 1
          """, (rs, rowNum) -> new ShareRecord(rs.getString("id"), rs.getTimestamp("deleted_at")), snapshotHash);
    } catch (EmptyResultDataAccessException error) {
      return null;
    }
  }

  public void restoreShare(String id, Timestamp expiresAt, String deleteTokenHash) {
    jdbcTemplate.update("""
        UPDATE share_snapshots
           SET deleted_at = NULL,
               expires_at = ?,
               delete_token_hash = ?
         WHERE id = ?
        """, expiresAt, deleteTokenHash, id);
  }

  public void insertShare(String id, Object schemaVersion, String snapshotHash, String payload, Timestamp expiresAt, String deleteTokenHash) {
    jdbcTemplate.update("""
        INSERT INTO share_snapshots
          (id, schema_version, snapshot_hash, payload, expires_at, delete_token_hash)
        VALUES
          (?, ?, ?, ?, ?, ?)
        """,
        id,
        schemaVersion,
        snapshotHash,
        payload,
        expiresAt,
        deleteTokenHash
    );
  }

  public String findActivePayload(String id) {
    return jdbcTemplate.queryForObject("""
        SELECT payload
          FROM share_snapshots
         WHERE id = ?
           AND deleted_at IS NULL
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1
        """, String.class, id);
  }

  public void incrementViewCount(String id) {
    jdbcTemplate.update("UPDATE share_snapshots SET view_count = view_count + 1 WHERE id = ?", id);
  }

  public ShareToken findActiveDeleteToken(String id) {
    return jdbcTemplate.queryForObject("""
        SELECT delete_token_hash
          FROM share_snapshots
         WHERE id = ?
           AND deleted_at IS NULL
         LIMIT 1
        """, (rs, rowNum) -> new ShareToken(rs.getString("delete_token_hash")), id);
  }

  public void markDeleted(String id) {
    jdbcTemplate.update("UPDATE share_snapshots SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL", id);
  }
}
