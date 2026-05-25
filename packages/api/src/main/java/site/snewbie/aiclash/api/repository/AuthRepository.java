package site.snewbie.aiclash.api.repository;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import site.snewbie.aiclash.api.model.AuthenticatedUser;

import java.sql.Timestamp;

@Repository
public class AuthRepository {
  private final JdbcTemplate jdbcTemplate;

  public AuthRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public void insertOauthState(String id, String provider, String returnTo, Timestamp expiresAt) {
    jdbcTemplate.update("""
        INSERT INTO oauth_states (id, provider, return_to, expires_at)
        VALUES (?, ?, ?, ?)
        """, id, provider, returnTo, expiresAt);
  }

  public String consumeOauthState(String id, String provider) {
    var consumed = jdbcTemplate.update("""
        UPDATE oauth_states
           SET consumed_at = NOW()
         WHERE id = ?
           AND provider = ?
           AND consumed_at IS NULL
           AND expires_at > NOW()
        """, id, provider);
    if (consumed == 0) return null;

    try {
      return jdbcTemplate.queryForObject("""
          SELECT return_to
            FROM oauth_states
           WHERE id = ?
             AND provider = ?
           LIMIT 1
          """, String.class, id, provider);
    } catch (EmptyResultDataAccessException error) {
      return null;
    }
  }

  public Long findUserIdByIdentity(String provider, String providerUserId) {
    try {
      return jdbcTemplate.queryForObject("""
          SELECT user_id
            FROM user_identities
           WHERE provider = ?
             AND provider_user_id = ?
           LIMIT 1
          """, Long.class, provider, providerUserId);
    } catch (EmptyResultDataAccessException error) {
      return null;
    }
  }

  public Long findUserIdByEmail(String normalizedEmail) {
    try {
      return jdbcTemplate.queryForObject("""
          SELECT user_id
            FROM user_emails
           WHERE normalized_email = ?
           LIMIT 1
          """, Long.class, normalizedEmail);
    } catch (EmptyResultDataAccessException error) {
      return null;
    }
  }

  public long insertUser(String displayName, String avatarUrl, String status) {
    jdbcTemplate.update("""
        INSERT INTO users (display_name, avatar_url, status, last_login_at)
        VALUES (?, ?, ?, NOW())
        """, displayName, avatarUrl, status);
    return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Number.class).longValue();
  }

  public long upsertEmail(long userId, String email, String normalizedEmail, String source, boolean verified, boolean primary) {
    var existingId = findEmailId(normalizedEmail);
    if (existingId != null) return existingId;

    jdbcTemplate.update("""
        INSERT INTO user_emails (user_id, email, normalized_email, verified, source, is_primary, verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, userId, email, normalizedEmail, verified, source, primary, verified ? new Timestamp(System.currentTimeMillis()) : null);
    return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Number.class).longValue();
  }

  public Long findEmailId(String normalizedEmail) {
    try {
      return jdbcTemplate.queryForObject("""
          SELECT id
            FROM user_emails
           WHERE normalized_email = ?
           LIMIT 1
          """, Long.class, normalizedEmail);
    } catch (EmptyResultDataAccessException error) {
      return null;
    }
  }

  public void setPrimaryEmail(long userId, long emailId) {
    jdbcTemplate.update("UPDATE user_emails SET is_primary = FALSE WHERE user_id = ?", userId);
    jdbcTemplate.update("UPDATE user_emails SET is_primary = TRUE WHERE id = ? AND user_id = ?", emailId, userId);
    jdbcTemplate.update("UPDATE users SET primary_email_id = ?, status = 'active' WHERE id = ?", emailId, userId);
  }

  public void upsertIdentity(long userId, String provider, String providerUserId, String providerLogin, String providerEmail, boolean providerEmailVerified, String profile) {
    jdbcTemplate.update("""
        INSERT INTO user_identities
          (user_id, provider, provider_user_id, provider_login, provider_email, provider_email_verified, profile, last_login_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          user_id = VALUES(user_id),
          provider_login = VALUES(provider_login),
          provider_email = VALUES(provider_email),
          provider_email_verified = VALUES(provider_email_verified),
          profile = VALUES(profile),
          last_login_at = NOW()
        """, userId, provider, providerUserId, providerLogin, providerEmail, providerEmailVerified, profile);
  }

  public void updateLoginProfile(long userId, String displayName, String avatarUrl) {
    jdbcTemplate.update("""
        UPDATE users
           SET display_name = ?,
               avatar_url = ?,
               last_login_at = NOW()
         WHERE id = ?
        """, displayName, avatarUrl, userId);
  }

  public void insertSession(String id, long userId, Timestamp expiresAt) {
    jdbcTemplate.update("""
        INSERT INTO auth_sessions (id, user_id, expires_at, last_seen_at)
        VALUES (?, ?, ?, NOW())
        """, id, userId, expiresAt);
  }

  public AuthenticatedUser findUserBySession(String sessionId) {
    try {
      return jdbcTemplate.queryForObject("""
          SELECT u.id,
                 u.display_name,
                 u.avatar_url,
                 u.status,
                 e.email,
                 i.provider,
                 i.provider_login
            FROM auth_sessions s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN user_emails e ON e.id = u.primary_email_id
            LEFT JOIN user_identities i ON i.user_id = u.id
           WHERE s.id = ?
             AND s.revoked_at IS NULL
             AND s.expires_at > NOW()
           ORDER BY i.last_login_at DESC, i.id DESC
           LIMIT 1
          """, (rs, rowNum) -> new AuthenticatedUser(
          rs.getLong("id"),
          rs.getString("display_name"),
          rs.getString("avatar_url"),
          rs.getString("status"),
          rs.getString("email"),
          rs.getString("provider"),
          rs.getString("provider_login")
      ), sessionId);
    } catch (EmptyResultDataAccessException error) {
      return null;
    }
  }

  public void touchSession(String sessionId) {
    jdbcTemplate.update("UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = ?", sessionId);
  }

  public void revokeSession(String sessionId) {
    jdbcTemplate.update("UPDATE auth_sessions SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL", sessionId);
  }
}
