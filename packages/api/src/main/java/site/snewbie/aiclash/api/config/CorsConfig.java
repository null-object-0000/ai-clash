package site.snewbie.aiclash.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
  private final AppProperties properties;

  public CorsConfig(AppProperties properties) {
    this.properties = properties;
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    var registration = registry.addMapping("/api/**")
        .allowedMethods("GET", "POST", "DELETE", "OPTIONS")
        .allowedHeaders("content-type", "x-delete-token");

    if (properties.corsOrigins().contains("*")) {
      registration.allowedOriginPatterns("*");
    } else {
      registration.allowedOrigins(properties.corsOrigins().toArray(String[]::new));
    }
  }
}
