package site.snewbie.aiclash.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
public class AppProperties {
  private final String publicSiteUrl;
  private final List<String> corsOrigins;
  private final int maxShareBytes;
  private final int shareDefaultTtlDays;
  private final Auth auth;
  private final NewApi newApi;

  public AppProperties(
      @Value("${app.public-site-url}") String publicSiteUrl,
      @Value("${app.cors-origins}") String corsOrigins,
      @Value("${app.max-share-bytes}") int maxShareBytes,
      @Value("${app.share-default-ttl-days}") int shareDefaultTtlDays,
      @Value("${app.auth.github-client-id}") String githubClientId,
      @Value("${app.auth.github-client-secret}") String githubClientSecret,
      @Value("${app.auth.github-redirect-uri}") String githubRedirectUri,
      @Value("${app.auth.google-client-id}") String googleClientId,
      @Value("${app.auth.google-client-secret}") String googleClientSecret,
      @Value("${app.auth.google-redirect-uri}") String googleRedirectUri,
      @Value("${app.auth.microsoft-client-id}") String microsoftClientId,
      @Value("${app.auth.microsoft-client-secret}") String microsoftClientSecret,
      @Value("${app.auth.microsoft-redirect-uri}") String microsoftRedirectUri,
      @Value("${app.auth.microsoft-tenant}") String microsoftTenant,
      @Value("${app.auth.allowed-return-origins}") String allowedReturnOrigins,
      @Value("${app.auth.session-days}") int sessionDays,
      @Value("${app.auth.session-cookie-name}") String sessionCookieName,
      @Value("${app.auth.cookie-secure}") boolean cookieSecure,
      @Value("${app.new-api.base-url}") String newApiBaseUrl,
      @Value("${app.new-api.api-key}") String newApiKey
  ) {
    this.publicSiteUrl = trimTrailingSlash(publicSiteUrl);
    this.corsOrigins = splitCsv(corsOrigins);
    this.maxShareBytes = maxShareBytes;
    this.shareDefaultTtlDays = shareDefaultTtlDays;
    this.auth = new Auth(
        githubClientId == null ? "" : githubClientId.trim(),
        githubClientSecret == null ? "" : githubClientSecret.trim(),
        trimTrailingSlash(githubRedirectUri),
        googleClientId == null ? "" : googleClientId.trim(),
        googleClientSecret == null ? "" : googleClientSecret.trim(),
        trimTrailingSlash(googleRedirectUri),
        microsoftClientId == null ? "" : microsoftClientId.trim(),
        microsoftClientSecret == null ? "" : microsoftClientSecret.trim(),
        trimTrailingSlash(microsoftRedirectUri),
        microsoftTenant == null || microsoftTenant.isBlank() ? "consumers" : microsoftTenant.trim(),
        splitCsv(allowedReturnOrigins).stream()
            .map(AppProperties::trimTrailingSlash)
            .filter(item -> !item.isBlank())
            .toList(),
        sessionDays,
        sessionCookieName == null || sessionCookieName.isBlank() ? "ai_clash_session" : sessionCookieName.trim(),
        cookieSecure
    );
    this.newApi = new NewApi(trimTrailingSlash(newApiBaseUrl), newApiKey == null ? "" : newApiKey.trim());
  }

  public String publicSiteUrl() {
    return publicSiteUrl;
  }

  public List<String> corsOrigins() {
    return corsOrigins;
  }

  public int maxShareBytes() {
    return maxShareBytes;
  }

  public int shareDefaultTtlDays() {
    return shareDefaultTtlDays;
  }

  public Auth auth() {
    return auth;
  }

  public NewApi newApi() {
    return newApi;
  }

  private static List<String> splitCsv(String value) {
    if (value == null || value.isBlank()) return List.of();
    return Arrays.stream(value.split(","))
        .map(String::trim)
        .filter(item -> !item.isBlank())
        .toList();
  }

  private static String trimTrailingSlash(String value) {
    if (value == null || value.isBlank()) return "";
    return value.replaceAll("/+$", "");
  }

  public record Auth(
      String githubClientId,
      String githubClientSecret,
      String githubRedirectUri,
      String googleClientId,
      String googleClientSecret,
      String googleRedirectUri,
      String microsoftClientId,
      String microsoftClientSecret,
      String microsoftRedirectUri,
      String microsoftTenant,
      List<String> allowedReturnOrigins,
      int sessionDays,
      String sessionCookieName,
      boolean cookieSecure
  ) {}

  public record NewApi(
      String baseUrl,
      String apiKey
  ) {}
}
