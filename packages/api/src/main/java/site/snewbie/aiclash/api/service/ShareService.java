package site.snewbie.aiclash.api.service;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.stereotype.Service;
import site.snewbie.aiclash.api.config.AppProperties;
import site.snewbie.aiclash.api.exception.ApiException;
import site.snewbie.aiclash.api.repository.ShareRepository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class ShareService {
  private final ShareRepository shareRepository;
  private final ObjectMapper objectMapper;
  private final AppProperties properties;
  private final ShareSnapshotValidator validator;

  public ShareService(
      ShareRepository shareRepository,
      ObjectMapper objectMapper,
      AppProperties properties,
      ShareSnapshotValidator validator
  ) {
    this.shareRepository = shareRepository;
    this.objectMapper = objectMapper;
    this.properties = properties;
    this.validator = validator;
  }

  public Map<String, Object> createShare(Map<String, Object> body) {
    var snapshot = validator.validate(body);
    var snapshotJson = writeJson(snapshot);
    var snapshotHash = hashSnapshot(snapshot);
    var deleteToken = token();
    var deleteTokenHash = sha256(deleteToken);
    var expiresAt = expiresAt();

    var existing = shareRepository.findBySnapshotHash(snapshotHash);
    if (existing != null) {
      shareRepository.restoreShare(existing.id(), expiresAt, deleteTokenHash);
      var response = response(existing.id(), deleteToken);
      response.put(existing.deletedAt() == null ? "existing" : "restored", true);
      return response;
    }

    for (var attempt = 0; attempt < 3; attempt++) {
      var id = id();
      try {
        shareRepository.insertShare(
            id,
            snapshot.get("schemaVersion"),
            snapshotHash,
            snapshotJson,
            expiresAt,
            deleteTokenHash
        );
        return response(id, deleteToken);
      } catch (Exception error) {
        if (attempt == 2) throw error;
      }
    }

    throw new ApiException(500, "failed to allocate share id");
  }

  public Map<String, Object> getShare(String id) {
    if (!isValidId(id)) throw new ApiException(404, "share not found");

    try {
      var payload = shareRepository.findActivePayload(id);
      if (payload == null) throw new ApiException(404, "share not found");

      shareRepository.incrementViewCount(id);
      return Map.of("id", id, "snapshot", readJson(payload));
    } catch (EmptyResultDataAccessException error) {
      throw new ApiException(404, "share not found");
    }
  }

  public Map<String, Object> deleteShare(String id, String deleteToken) {
    if (!isValidId(id)) throw new ApiException(404, "share not found");
    if (deleteToken == null || deleteToken.isBlank()) throw new ApiException(401, "delete token is required");

    try {
      var token = shareRepository.findActiveDeleteToken(id);
      if (token == null || token.deleteTokenHash() == null || !MessageDigest.isEqual(
          token.deleteTokenHash().getBytes(StandardCharsets.UTF_8),
          sha256(deleteToken).getBytes(StandardCharsets.UTF_8)
      )) {
        throw new ApiException(403, "delete token is invalid");
      }
    } catch (EmptyResultDataAccessException error) {
      throw new ApiException(404, "share not found");
    }

    shareRepository.markDeleted(id);
    return Map.of("ok", true);
  }

  private Map<String, Object> response(String id, String deleteToken) {
    var response = new LinkedHashMap<String, Object>();
    response.put("id", id);
    response.put("url", properties.publicSiteUrl() + "/share/" + id);
    response.put("deleteToken", deleteToken);
    return response;
  }

  private Timestamp expiresAt() {
    if (properties.shareDefaultTtlDays() <= 0) return null;
    return Timestamp.from(Instant.now().plus(properties.shareDefaultTtlDays(), ChronoUnit.DAYS));
  }

  private String hashSnapshot(Map<String, Object> snapshot) {
    var hashable = new LinkedHashMap<>(snapshot);
    hashable.remove("createdAt");
    return sha256(writeJson(hashable));
  }

  private String writeJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception error) {
      throw new ApiException(400, "invalid JSON body");
    }
  }

  private Map<String, Object> readJson(String value) {
    try {
      return objectMapper.readValue(value, new TypeReference<>() {});
    } catch (Exception error) {
      throw new ApiException(500, "stored share payload is invalid");
    }
  }

  private static String id() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
  }

  private static String token() {
    return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
  }

  private static boolean isValidId(String id) {
    return id != null && id.matches("^[A-Za-z0-9_-]{8,32}$");
  }

  private static String sha256(String value) {
    try {
      var digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException(error);
    }
  }
}
