package site.snewbie.aiclash.api.service;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import site.snewbie.aiclash.api.config.AppProperties;
import site.snewbie.aiclash.api.exception.ApiException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AiProxyService {
  private final AppProperties properties;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;

  public AiProxyService(AppProperties properties, ObjectMapper objectMapper) {
    this.properties = properties;
    this.objectMapper = objectMapper;
    this.httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(15))
        .build();
  }

  public Map<String, Object> listModels() {
    return send("GET", "/v1/models", null);
  }

  public Map<String, Object> createChatCompletion(Map<String, Object> body) {
    if (body == null) throw new ApiException(400, "request body is required");
    var requestBody = new LinkedHashMap<>(body);
    mergeExtraBody(requestBody);
    requestBody.put("stream", false);
    return send("POST", "/v1/chat/completions", requestBody);
  }

  public void streamChatCompletion(Map<String, Object> body, HttpServletResponse servletResponse) {
    if (body == null) throw new ApiException(400, "request body is required");
    var requestBody = new LinkedHashMap<>(body);
    mergeExtraBody(requestBody);
    requestBody.put("stream", true);

    var response = sendStream("/v1/chat/completions", requestBody);
    servletResponse.setStatus(response.statusCode());
    servletResponse.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE);
    servletResponse.setCharacterEncoding(StandardCharsets.UTF_8.name());
    servletResponse.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache");
    servletResponse.setHeader(HttpHeaders.CONNECTION, "keep-alive");
    servletResponse.setHeader("X-Accel-Buffering", "no");

    try (InputStream input = response.body(); OutputStream output = servletResponse.getOutputStream()) {
      var buffer = new byte[8192];
      int length;
      while ((length = input.read(buffer)) != -1) {
        output.write(buffer, 0, length);
        output.flush();
      }
    } catch (Exception error) {
      throw new ApiException(502, "new-api stream failed");
    }
  }

  private Map<String, Object> send(String method, String path, Object body) {
    var config = properties.newApi();
    if (config.baseUrl().isBlank() || config.apiKey().isBlank()) {
      throw new ApiException(500, "new-api is not configured");
    }

    var builder = HttpRequest.newBuilder(URI.create(config.baseUrl() + path))
        .timeout(Duration.ofSeconds(90))
        .header("accept", "application/json")
        .header("authorization", "Bearer " + config.apiKey());

    if ("POST".equals(method)) {
      builder.header("content-type", "application/json")
          .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)));
    } else {
      builder.GET();
    }

    try {
      var response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
      var data = readJson(response.body());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new ApiException(response.statusCode(), errorMessage(data));
      }
      return data;
    } catch (ApiException error) {
      throw error;
    } catch (Exception error) {
      throw new ApiException(502, "new-api request failed");
    }
  }

  private HttpResponse<InputStream> sendStream(String path, Object body) {
    var config = properties.newApi();
    if (config.baseUrl().isBlank() || config.apiKey().isBlank()) {
      throw new ApiException(500, "new-api is not configured");
    }

    var request = HttpRequest.newBuilder(URI.create(config.baseUrl() + path))
        .timeout(Duration.ofSeconds(180))
        .header("accept", "text/event-stream")
        .header("authorization", "Bearer " + config.apiKey())
        .header("content-type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(writeJson(body)))
        .build();

    try {
      var response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        try (InputStream input = response.body()) {
          throw new ApiException(response.statusCode(), errorMessage(readJson(new String(input.readAllBytes(), StandardCharsets.UTF_8))));
        }
      }
      return response;
    } catch (ApiException error) {
      throw error;
    } catch (Exception error) {
      throw new ApiException(502, "new-api request failed");
    }
  }

  private String writeJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception error) {
      throw new ApiException(500, "failed to encode request");
    }
  }

  private static void mergeExtraBody(Map<String, Object> requestBody) {
    var extraBody = requestBody.remove("extra_body");
    if (extraBody instanceof Map<?, ?> map) {
      map.forEach((key, value) -> {
        if (key != null) requestBody.put(String.valueOf(key), value);
      });
    }
  }

  private Map<String, Object> readJson(String value) {
    try {
      return objectMapper.readValue(value, new TypeReference<>() {});
    } catch (Exception error) {
      throw new ApiException(502, "new-api returned invalid JSON");
    }
  }

  private static String errorMessage(Map<String, Object> data) {
    var error = data.get("error");
    if (error instanceof Map<?, ?> map) {
      var message = map.get("message");
      if (message != null) return String.valueOf(message);
    }
    if (error != null) return String.valueOf(error);
    return "new-api request failed";
  }
}
