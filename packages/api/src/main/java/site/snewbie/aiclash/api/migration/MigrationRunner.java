package site.snewbie.aiclash.api.migration;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class MigrationRunner implements ApplicationRunner {
  private final JdbcTemplate jdbcTemplate;

  public MigrationRunner(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public void run(ApplicationArguments args) throws Exception {
    jdbcTemplate.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name VARCHAR(255) PRIMARY KEY,
          applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """);

    var resolver = new PathMatchingResourcePatternResolver();
    var resources = resolver.getResources("classpath:/migrations/*.sql");
    java.util.Arrays.sort(resources, java.util.Comparator.comparing(resource -> resource.getFilename() == null ? "" : resource.getFilename()));

    for (var resource : resources) {
      var name = resource.getFilename();
      if (name == null) continue;
      var exists = jdbcTemplate.queryForObject(
          "SELECT COUNT(*) FROM schema_migrations WHERE name = ?",
          Integer.class,
          name
      );
      if (exists != null && exists > 0) continue;

      var sql = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
      jdbcTemplate.execute(sql);
      jdbcTemplate.update("INSERT INTO schema_migrations (name) VALUES (?)", name);
    }
  }
}
