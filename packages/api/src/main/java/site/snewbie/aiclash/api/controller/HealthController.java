package site.snewbie.aiclash.api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.util.Map;

@RestController
public class HealthController {
  @GetMapping("/healthz")
  public Map<String, Object> healthz() {
    var uptimeSeconds = ManagementFactory.getRuntimeMXBean().getUptime() / 1000.0;
    return Map.of("ok", true, "uptime", uptimeSeconds);
  }
}
