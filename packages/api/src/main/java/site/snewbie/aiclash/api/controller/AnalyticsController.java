package site.snewbie.aiclash.api.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import site.snewbie.aiclash.api.config.AppProperties;
import site.snewbie.aiclash.api.exception.ApiException;

import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {
  private final AppProperties properties;
  private final RestClient restClient;

  public AnalyticsController(AppProperties properties) {
    this.properties = properties;
    this.restClient = RestClient.builder()
        .baseUrl(properties.umamiHostUrl())
        .build();
  }

  @PostMapping
  public ResponseEntity<Map<String, Object>> send(
      @RequestBody Map<String, Object> body,
      HttpServletRequest request
  ) {
    if (properties.umamiWebsiteId().isBlank()) {
      throw new ApiException(503, "analytics is not configured");
    }
    if (request.getContentLengthLong() > properties.maxAnalyticsBytes()) {
      throw new ApiException(413, "analytics payload is too large");
    }
    if (!"event".equals(body.get("type")) || !(body.get("payload") instanceof Map<?, ?> payload)) {
      throw new ApiException(400, "invalid analytics payload");
    }

    @SuppressWarnings("unchecked")
    var mutablePayload = new java.util.LinkedHashMap<String, Object>((Map<String, Object>) payload);
    mutablePayload.put("website", properties.umamiWebsiteId());
    var upstreamBody = Map.of(
        "type", "event",
        "payload", mutablePayload
    );

    restClient.post()
        .uri("/api/send")
        .contentType(MediaType.APPLICATION_JSON)
        .body(upstreamBody)
        .retrieve()
        .onStatus(HttpStatusCode::isError, (req, res) -> {
          throw new ApiException(502, "analytics upstream failed");
        })
        .toBodilessEntity();

    return ResponseEntity.accepted().body(Map.of("ok", true));
  }
}
