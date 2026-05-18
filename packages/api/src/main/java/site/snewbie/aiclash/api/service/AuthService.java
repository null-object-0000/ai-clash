package site.snewbie.aiclash.api.service;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import site.snewbie.aiclash.api.config.AppProperties;
import site.snewbie.aiclash.api.exception.ApiException;
import site.snewbie.aiclash.api.model.AuthenticatedUser;
import site.snewbie.aiclash.api.model.GithubEmail;
import site.snewbie.aiclash.api.model.GithubUser;
import site.snewbie.aiclash.api.repository.AuthRepository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {
  private static final String GITHUB_PROVIDER = "github";

  private final AuthRepository authRepository;
  private final AppProperties properties;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;

  public AuthService(AuthRepository authRepository, AppProperties properties, ObjectMapper objectMapper) {
    this.authRepository = authRepository;
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  }

  public String githubStartUrl(String returnTo) {
    var auth = properties.auth();
    if (auth.githubClientId().isBlank() || auth.githubClientSecret().isBlank()) {
      throw new ApiException(500, "GitHub OAuth is not configured");
    }

    var safeReturnTo = safeReturnTo(returnTo);
    var state = token();
    authRepository.insertOauthState(
        sha256(state),
        GITHUB_PROVIDER,
        safeReturnTo,
        Timestamp.from(Instant.now().plus(10, ChronoUnit.MINUTES))
    );

    return UriComponentsBuilder.fromUriString("https://github.com/login/oauth/authorize")
        .queryParam("client_id", auth.githubClientId())
        .queryParam("redirect_uri", auth.githubRedirectUri())
        .queryParam("scope", "read:user user:email")
        .queryParam("state", state)
        .build()
        .toUriString();
  }

  public LoginResult githubCallback(String code, String state) {
    if (code == null || code.isBlank() || state == null || state.isBlank()) {
      throw new ApiException(400, "invalid GitHub callback");
    }

    var returnTo = authRepository.consumeOauthState(sha256(state), GITHUB_PROVIDER);
    if (returnTo == null) throw new ApiException(400, "invalid or expired OAuth state");

    var accessToken = exchangeGithubCode(code);
    var githubUser = fetchGithubUser(accessToken);
    var githubEmail = fetchPrimaryGithubEmail(accessToken);
    var userId = loginGithubUser(githubUser, githubEmail);
    var sessionToken = token();
    var expiresAt = Instant.now().plus(Math.max(1, properties.auth().sessionDays()), ChronoUnit.DAYS);
    authRepository.insertSession(sha256(sessionToken), userId, Timestamp.from(expiresAt));

    return new LoginResult(returnTo, sessionCookie(sessionToken, expiresAt));
  }

  public AuthenticatedUser currentUser(HttpServletRequest request) {
    var sessionToken = readCookie(request);
    if (sessionToken == null || sessionToken.isBlank()) return null;

    var user = authRepository.findUserBySession(sha256(sessionToken));
    if (user != null) authRepository.touchSession(sha256(sessionToken));
    return user;
  }

  public ResponseCookie logoutCookie(HttpServletRequest request) {
    var sessionToken = readCookie(request);
    if (sessionToken != null && !sessionToken.isBlank()) {
      authRepository.revokeSession(sha256(sessionToken));
    }
    return cookieBuilder("").maxAge(Duration.ZERO).build();
  }

  public ResponseCookie sessionCookie(String sessionToken, Instant expiresAt) {
    return cookieBuilder(sessionToken)
        .maxAge(Duration.between(Instant.now(), expiresAt))
        .build();
  }

  private long loginGithubUser(GithubUser githubUser, GithubEmail githubEmail) {
    var providerEmail = githubEmail == null ? githubUser.email() : githubEmail.email();
    var providerEmailVerified = githubEmail != null && githubEmail.verified();
    var existingUserId = authRepository.findUserIdByIdentity(GITHUB_PROVIDER, githubUser.id());
    var displayName = firstNonBlank(githubUser.name(), githubUser.login());

    long userId;
    if (existingUserId != null) {
      userId = existingUserId;
    } else if (providerEmailVerified && providerEmail != null && !providerEmail.isBlank()) {
      var normalizedEmail = normalizeEmail(providerEmail);
      var emailUserId = authRepository.findUserIdByEmail(normalizedEmail);
      userId = emailUserId != null ? emailUserId : authRepository.insertUser(displayName, githubUser.avatarUrl(), "pending");
    } else {
      userId = authRepository.insertUser(displayName, githubUser.avatarUrl(), "pending");
    }

    if (providerEmailVerified && providerEmail != null && !providerEmail.isBlank()) {
      var normalizedEmail = normalizeEmail(providerEmail);
      var emailUserId = authRepository.findUserIdByEmail(normalizedEmail);
      if (emailUserId == null || emailUserId == userId) {
        var emailId = authRepository.upsertEmail(userId, providerEmail, normalizedEmail, GITHUB_PROVIDER, true, true);
        authRepository.setPrimaryEmail(userId, emailId);
      }
    }

    authRepository.updateLoginProfile(userId, displayName, githubUser.avatarUrl());
    authRepository.upsertIdentity(
        userId,
        GITHUB_PROVIDER,
        githubUser.id(),
        githubUser.login(),
        providerEmail,
        providerEmailVerified,
        writeJson(Map.of(
            "id", githubUser.id(),
            "login", githubUser.login(),
            "name", displayName,
            "avatarUrl", githubUser.avatarUrl() == null ? "" : githubUser.avatarUrl()
        ))
    );
    return userId;
  }

  private String exchangeGithubCode(String code) {
    var auth = properties.auth();
    var body = writeJson(Map.of(
        "client_id", auth.githubClientId(),
        "client_secret", auth.githubClientSecret(),
        "code", code,
        "redirect_uri", auth.githubRedirectUri()
    ));
    var response = send(HttpRequest.newBuilder(URI.create("https://github.com/login/oauth/access_token"))
        .header("accept", "application/json")
        .header("content-type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build());
    var data = readJson(response);
    var error = stringValue(data.get("error_description"));
    if (error != null) throw new ApiException(401, error);
    var accessToken = stringValue(data.get("access_token"));
    if (accessToken == null || accessToken.isBlank()) throw new ApiException(401, "GitHub did not return an access token");
    return accessToken;
  }

  private GithubUser fetchGithubUser(String accessToken) {
    var data = readJson(send(githubGet("https://api.github.com/user", accessToken)));
    var id = stringValue(data.get("id"));
    var login = stringValue(data.get("login"));
    if (id == null || login == null) throw new ApiException(401, "GitHub user profile is incomplete");
    return new GithubUser(
        id,
        login,
        stringValue(data.get("name")),
        stringValue(data.get("avatar_url")),
        stringValue(data.get("email"))
    );
  }

  private GithubEmail fetchPrimaryGithubEmail(String accessToken) {
    var response = send(githubGet("https://api.github.com/user/emails", accessToken));
    List<Map<String, Object>> emails;
    try {
      emails = objectMapper.readValue(response, new TypeReference<>() {});
    } catch (Exception error) {
      throw new ApiException(401, "GitHub email profile is invalid");
    }
    return emails.stream()
        .filter(item -> Boolean.TRUE.equals(item.get("primary")))
        .findFirst()
        .map(item -> new GithubEmail(
            stringValue(item.get("email")),
            Boolean.TRUE.equals(item.get("primary")),
            Boolean.TRUE.equals(item.get("verified"))
        ))
        .orElse(null);
  }

  private HttpRequest githubGet(String url, String accessToken) {
    return HttpRequest.newBuilder(URI.create(url))
        .header("accept", "application/vnd.github+json")
        .header("authorization", "Bearer " + accessToken)
        .GET()
        .build();
  }

  private String send(HttpRequest request) {
    try {
      var response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new ApiException(401, "GitHub OAuth request failed");
      }
      return response.body();
    } catch (ApiException error) {
      throw error;
    } catch (Exception error) {
      throw new ApiException(502, "GitHub OAuth request failed");
    }
  }

  private String safeReturnTo(String returnTo) {
    if (returnTo == null || returnTo.isBlank()) return properties.publicSiteUrl();
    URI uri;
    try {
      uri = URI.create(returnTo);
    } catch (IllegalArgumentException error) {
      return properties.publicSiteUrl();
    }
    if (!uri.isAbsolute()) {
      return properties.publicSiteUrl() + (returnTo.startsWith("/") ? returnTo : "/" + returnTo);
    }
    if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
      return properties.publicSiteUrl();
    }
    var origin = uri.getScheme() + "://" + uri.getAuthority();
    if (!properties.auth().allowedReturnOrigins().contains(origin.replaceAll("/+$", ""))) {
      return properties.publicSiteUrl();
    }
    return returnTo;
  }

  private ResponseCookie.ResponseCookieBuilder cookieBuilder(String value) {
    return ResponseCookie.from(properties.auth().sessionCookieName(), value)
        .httpOnly(true)
        .secure(properties.auth().cookieSecure())
        .sameSite("Lax")
        .path("/");
  }

  private String readCookie(HttpServletRequest request) {
    Cookie[] cookies = request.getCookies();
    if (cookies == null) return null;
    for (var cookie : cookies) {
      if (properties.auth().sessionCookieName().equals(cookie.getName())) return cookie.getValue();
    }
    return null;
  }

  private Map<String, Object> readJson(String value) {
    try {
      return objectMapper.readValue(value, new TypeReference<>() {});
    } catch (Exception error) {
      throw new ApiException(502, "GitHub returned invalid JSON");
    }
  }

  private String writeJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception error) {
      throw new ApiException(500, "failed to encode JSON");
    }
  }

  private static String stringValue(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private static String firstNonBlank(String first, String second) {
    return first != null && !first.isBlank() ? first : second;
  }

  private static String normalizeEmail(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }

  private static String token() {
    return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
  }

  private static String sha256(String value) {
    try {
      var digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException(error);
    }
  }

  public record LoginResult(String returnTo, ResponseCookie cookie) {}
}
