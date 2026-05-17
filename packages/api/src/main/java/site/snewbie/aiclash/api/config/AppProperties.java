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

  public AppProperties(
      @Value("${app.public-site-url}") String publicSiteUrl,
      @Value("${app.cors-origins}") String corsOrigins,
      @Value("${app.max-share-bytes}") int maxShareBytes,
      @Value("${app.share-default-ttl-days}") int shareDefaultTtlDays
  ) {
    this.publicSiteUrl = trimTrailingSlash(publicSiteUrl);
    this.corsOrigins = Arrays.stream(corsOrigins.split(","))
        .map(String::trim)
        .filter(item -> !item.isBlank())
        .toList();
    this.maxShareBytes = maxShareBytes;
    this.shareDefaultTtlDays = shareDefaultTtlDays;
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

  private static String trimTrailingSlash(String value) {
    if (value == null || value.isBlank()) return "";
    return value.replaceAll("/+$", "");
  }
}
