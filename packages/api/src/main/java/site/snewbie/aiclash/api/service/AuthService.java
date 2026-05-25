package site.snewbie.aiclash.api.service;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import site.snewbie.aiclash.api.config.AppProperties;
import site.snewbie.aiclash.api.exception.ApiException;
import site.snewbie.aiclash.api.model.AuthenticatedUser;
import site.snewbie.aiclash.api.model.AuthIdentity;
import site.snewbie.aiclash.api.model.GithubEmail;
import site.snewbie.aiclash.api.model.GithubUser;
import site.snewbie.aiclash.api.model.OAuthUserProfile;
import site.snewbie.aiclash.api.repository.AuthRepository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
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
  private static final String GOOGLE_PROVIDER = "google";
  private static final String MICROSOFT_PROVIDER = "microsoft";

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
        .encode()
        .toUriString();
  }

  public String microsoftStartUrl(String returnTo) {
    var auth = properties.auth();
    if (auth.microsoftClientId().isBlank() || auth.microsoftClientSecret().isBlank()) {
      throw new ApiException(500, "Microsoft OAuth is not configured");
    }

    var safeReturnTo = safeReturnTo(returnTo);
    var state = token();
    authRepository.insertOauthState(
        sha256(state),
        MICROSOFT_PROVIDER,
        safeReturnTo,
        Timestamp.from(Instant.now().plus(10, ChronoUnit.MINUTES))
    );

    return UriComponentsBuilder.fromUriString(microsoftBaseUrl() + "/oauth2/v2.0/authorize")
        .queryParam("client_id", auth.microsoftClientId())
        .queryParam("redirect_uri", auth.microsoftRedirectUri())
        .queryParam("response_type", "code")
        .queryParam("scope", "openid profile email User.Read")
        .queryParam("state", state)
        .build()
        .encode()
        .toUriString();
  }

  public String googleStartUrl(String returnTo) {
    var auth = properties.auth();
    if (auth.googleClientId().isBlank() || auth.googleClientSecret().isBlank()) {
      throw new ApiException(500, "Google OAuth is not configured");
    }

    var safeReturnTo = safeReturnTo(returnTo);
    var state = token();
    authRepository.insertOauthState(
        sha256(state),
        GOOGLE_PROVIDER,
        safeReturnTo,
        Timestamp.from(Instant.now().plus(10, ChronoUnit.MINUTES))
    );

    return UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
        .queryParam("client_id", auth.googleClientId())
        .queryParam("redirect_uri", auth.googleRedirectUri())
        .queryParam("response_type", "code")
        .queryParam("scope", "openid email profile")
        .queryParam("state", state)
        .build()
        .encode()
        .toUriString();
  }

  public LoginResult githubCallback(String code, String state, HttpServletRequest request) {
    if (code == null || code.isBlank() || state == null || state.isBlank()) {
      throw new ApiException(400, "invalid GitHub callback");
    }

    var returnTo = authRepository.consumeOauthState(sha256(state), GITHUB_PROVIDER);
    if (returnTo == null) throw new ApiException(400, "invalid or expired OAuth state");

    var accessToken = exchangeGithubCode(code);
    var githubUser = fetchGithubUser(accessToken);
    var githubEmail = fetchPrimaryGithubEmail(accessToken);
    var currentUser = currentUser(request);
    var userId = loginGithubUser(githubUser, githubEmail, currentUser == null ? null : currentUser.id());
    var sessionToken = token();
    var expiresAt = Instant.now().plus(Math.max(1, properties.auth().sessionDays()), ChronoUnit.DAYS);
    authRepository.insertSession(sha256(sessionToken), userId, Timestamp.from(expiresAt));

    return new LoginResult(returnTo, sessionCookie(sessionToken, expiresAt));
  }

  public LoginResult microsoftCallback(String code, String state, HttpServletRequest request) {
    if (code == null || code.isBlank() || state == null || state.isBlank()) {
      throw new ApiException(400, "invalid Microsoft callback");
    }

    var returnTo = authRepository.consumeOauthState(sha256(state), MICROSOFT_PROVIDER);
    if (returnTo == null) throw new ApiException(400, "invalid or expired OAuth state");

    var accessToken = exchangeMicrosoftCode(code);
    var profile = fetchMicrosoftProfile(accessToken);
    var currentUser = currentUser(request);
    var userId = loginOAuthUser(profile, currentUser == null ? null : currentUser.id());
    var sessionToken = token();
    var expiresAt = Instant.now().plus(Math.max(1, properties.auth().sessionDays()), ChronoUnit.DAYS);
    authRepository.insertSession(sha256(sessionToken), userId, Timestamp.from(expiresAt));

    return new LoginResult(returnTo, sessionCookie(sessionToken, expiresAt));
  }

  public LoginResult googleCallback(String code, String state, HttpServletRequest request) {
    if (code == null || code.isBlank() || state == null || state.isBlank()) {
      throw new ApiException(400, "invalid Google callback");
    }

    var returnTo = authRepository.consumeOauthState(sha256(state), GOOGLE_PROVIDER);
    if (returnTo == null) throw new ApiException(400, "invalid or expired OAuth state");

    var accessToken = exchangeGoogleCode(code);
    var profile = fetchGoogleProfile(accessToken);
    var currentUser = currentUser(request);
    var userId = loginOAuthUser(profile, currentUser == null ? null : currentUser.id());
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

  public List<AuthIdentity> currentUserIdentities(long userId) {
    return authRepository.findIdentitiesByUserId(userId);
  }

  public ResponseCookie sessionCookie(String sessionToken, Instant expiresAt) {
    return cookieBuilder(sessionToken)
        .maxAge(Duration.between(Instant.now(), expiresAt))
        .build();
  }

  private long loginGithubUser(GithubUser githubUser, GithubEmail githubEmail, Long currentUserId) {
    var providerEmail = githubEmail == null ? githubUser.email() : githubEmail.email();
    var providerEmailVerified = githubEmail != null && githubEmail.verified();
    return loginOAuthUser(new OAuthUserProfile(
        GITHUB_PROVIDER,
        githubUser.id(),
        githubUser.login(),
        firstNonBlank(githubUser.name(), githubUser.login()),
        githubUser.avatarUrl(),
        providerEmail,
        providerEmailVerified
    ), currentUserId);
  }

  private long loginOAuthUser(OAuthUserProfile profile, Long currentUserId) {
    var existingUserId = authRepository.findUserIdByIdentity(profile.provider(), profile.id());
    var displayName = firstNonBlank(profile.name(), profile.login());
    Long emailUserId = null;
    String normalizedEmail = null;
    if (profile.emailVerified() && profile.email() != null && !profile.email().isBlank()) {
      normalizedEmail = normalizeEmail(profile.email());
      emailUserId = authRepository.findUserIdByEmail(normalizedEmail);
    }

    long userId;
    if (currentUserId != null) {
      userId = currentUserId;
    } else if (emailUserId != null) {
      userId = emailUserId;
    } else if (existingUserId != null) {
      userId = existingUserId;
    } else {
      userId = authRepository.insertUser(displayName, profile.avatarUrl(), "pending");
    }

    if (normalizedEmail != null) {
      if (emailUserId == null || emailUserId == userId) {
        var emailId = authRepository.upsertEmail(userId, profile.email(), normalizedEmail, profile.provider(), true, true);
        authRepository.setPrimaryEmail(userId, emailId);
      }
    }

    authRepository.touchUserLogin(userId);
    authRepository.initializeMissingUserProfile(userId, displayName, profile.avatarUrl());
    authRepository.upsertIdentity(
        userId,
        profile.provider(),
        profile.id(),
        profile.login(),
        profile.email(),
        profile.emailVerified(),
        displayName,
        profile.avatarUrl(),
        writeJson(Map.of(
            "id", profile.id(),
            "login", profile.login(),
            "name", displayName,
            "avatarUrl", profile.avatarUrl() == null ? "" : profile.avatarUrl()
        ))
    );
    return userId;
  }

  public void updateProfile(HttpServletRequest request, Map<String, Object> body) {
    var user = currentUser(request);
    if (user == null) throw new ApiException(401, "login required");

    var displayName = readProfileString(body.get("displayName"), 100);
    var avatarUrl = readProfileString(body.get("avatarUrl"), 500);
    if (displayName.isBlank()) throw new ApiException(422, "display name is required");
    if (!avatarUrl.isBlank() && !isHttpUrl(avatarUrl)) throw new ApiException(422, "avatar URL must be http or https");

    authRepository.updateUserProfile(user.id(), displayName, avatarUrl.isBlank() ? null : avatarUrl);
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

  private String exchangeMicrosoftCode(String code) {
    var auth = properties.auth();
    var body = form(Map.of(
        "client_id", auth.microsoftClientId(),
        "client_secret", auth.microsoftClientSecret(),
        "code", code,
        "redirect_uri", auth.microsoftRedirectUri(),
        "grant_type", "authorization_code",
        "scope", "openid profile email User.Read"
    ));
    var response = send(HttpRequest.newBuilder(URI.create(microsoftBaseUrl() + "/oauth2/v2.0/token"))
        .header("accept", "application/json")
        .header("content-type", "application/x-www-form-urlencoded")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build());
    var data = readJson(response);
    var error = stringValue(data.get("error_description"));
    if (error != null) throw new ApiException(401, error);
    var accessToken = stringValue(data.get("access_token"));
    if (accessToken == null || accessToken.isBlank()) throw new ApiException(401, "Microsoft did not return an access token");
    return accessToken;
  }

  private String exchangeGoogleCode(String code) {
    var auth = properties.auth();
    var body = form(Map.of(
        "client_id", auth.googleClientId(),
        "client_secret", auth.googleClientSecret(),
        "code", code,
        "redirect_uri", auth.googleRedirectUri(),
        "grant_type", "authorization_code"
    ));
    var response = send(HttpRequest.newBuilder(URI.create("https://oauth2.googleapis.com/token"))
        .header("accept", "application/json")
        .header("content-type", "application/x-www-form-urlencoded")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build());
    var data = readJson(response);
    var error = stringValue(data.get("error_description"));
    if (error != null) throw new ApiException(401, error);
    var accessToken = stringValue(data.get("access_token"));
    if (accessToken == null || accessToken.isBlank()) throw new ApiException(401, "Google did not return an access token");
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

  private OAuthUserProfile fetchMicrosoftProfile(String accessToken) {
    var data = readJson(send(HttpRequest.newBuilder(URI.create("https://graph.microsoft.com/oidc/userinfo"))
        .header("accept", "application/json")
        .header("authorization", "Bearer " + accessToken)
        .GET()
        .build()));
    var graphProfile = fetchMicrosoftGraphProfile(accessToken);
    var id = firstNonBlank(stringValue(data.get("sub")), stringValue(data.get("oid")));
    var login = firstNonBlank(
        firstNonBlank(stringValue(data.get("preferred_username")), stringValue(data.get("email"))),
        firstNonBlank(stringValue(data.get("upn")), stringValue(graphProfile.get("userPrincipalName")))
    );
    var name = firstNonBlank(stringValue(data.get("name")), stringValue(graphProfile.get("displayName")));
    var email = firstNonBlank(
        firstNonBlank(stringValue(data.get("email")), stringValue(data.get("preferred_username"))),
        firstNonBlank(stringValue(data.get("upn")), firstNonBlank(stringValue(graphProfile.get("mail")), stringValue(graphProfile.get("userPrincipalName"))))
    );
    if (id == null || id.isBlank()) throw new ApiException(401, "Microsoft user profile is incomplete");
    return new OAuthUserProfile(
        MICROSOFT_PROVIDER,
        id,
        firstNonBlank(login, id),
        firstNonBlank(name, login),
        stringValue(data.get("picture")),
        email,
        email != null && !email.isBlank()
    );
  }

  private OAuthUserProfile fetchGoogleProfile(String accessToken) {
    var data = readJson(send(HttpRequest.newBuilder(URI.create("https://openidconnect.googleapis.com/v1/userinfo"))
        .header("accept", "application/json")
        .header("authorization", "Bearer " + accessToken)
        .GET()
        .build()));
    var id = stringValue(data.get("sub"));
    var email = stringValue(data.get("email"));
    var name = stringValue(data.get("name"));
    var picture = stringValue(data.get("picture"));
    if (id == null || id.isBlank()) throw new ApiException(401, "Google user profile is incomplete");
    return new OAuthUserProfile(
        GOOGLE_PROVIDER,
        id,
        firstNonBlank(email, id),
        firstNonBlank(name, email),
        picture,
        email,
        Boolean.TRUE.equals(data.get("email_verified"))
    );
  }

  private Map<String, Object> fetchMicrosoftGraphProfile(String accessToken) {
    try {
      return readJson(send(HttpRequest.newBuilder(URI.create("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName"))
          .header("accept", "application/json")
          .header("authorization", "Bearer " + accessToken)
          .GET()
          .build()));
    } catch (ApiException error) {
      return Map.of();
    }
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

  private String microsoftBaseUrl() {
    return "https://login.microsoftonline.com/" + properties.auth().microsoftTenant();
  }

  private static String form(Map<String, String> values) {
    return values.entrySet().stream()
        .map(entry -> urlEncode(entry.getKey()) + "=" + urlEncode(entry.getValue()))
        .reduce((left, right) -> left + "&" + right)
        .orElse("");
  }

  private static String urlEncode(String value) {
    return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
  }

  private static String stringValue(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private static String readProfileString(Object value, int maxLength) {
    if (!(value instanceof String text)) return "";
    var trimmed = text.trim();
    return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
  }

  private static boolean isHttpUrl(String value) {
    try {
      var uri = URI.create(value);
      return "http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme());
    } catch (IllegalArgumentException error) {
      return false;
    }
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
