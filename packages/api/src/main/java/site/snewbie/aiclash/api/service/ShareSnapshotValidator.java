package site.snewbie.aiclash.api.service;

import org.springframework.stereotype.Component;
import site.snewbie.aiclash.api.exception.ApiException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class ShareSnapshotValidator {
  private static final int MAX_TEXT_LENGTH = 80_000;
  private static final int MAX_PROVIDERS = 12;

  public Map<String, Object> validate(Map<String, Object> input) {
    var errors = new ArrayList<String>();
    var question = readString(input.get("question"), MAX_TEXT_LENGTH);
    if (question.isBlank()) errors.add("question is required");

    var rawProviders = input.get("providers") instanceof List<?> list ? list : List.of();
    if (rawProviders.isEmpty()) errors.add("providers must include at least one item");
    if (rawProviders.size() > MAX_PROVIDERS) errors.add("providers cannot exceed " + MAX_PROVIDERS + " items");

    var providers = new ArrayList<Map<String, Object>>();
    for (int index = 0; index < Math.min(rawProviders.size(), MAX_PROVIDERS); index++) {
      var rawProvider = rawProviders.get(index);
      if (!(rawProvider instanceof Map<?, ?> rawMap)) {
        errors.add("providers[" + index + "] must be an object");
        continue;
      }

      var provider = readProvider(rawMap, index, errors);
      if (provider != null) providers.add(provider);
    }

    if (!errors.isEmpty()) {
      throw new ApiException(422, "invalid share snapshot: " + String.join("; ", errors));
    }

    var result = new LinkedHashMap<String, Object>();
    result.put("schemaVersion", 1);
    result.put("title", defaultTitle(readString(input.get("title"), 160), question));
    result.put("question", question);
    result.put("createdAt", readNumber(input.get("createdAt"), System.currentTimeMillis()));
    result.put("locale", "en".equals(input.get("locale")) ? "en" : "zh");
    result.put("providers", providers);

    var summary = readSummary(input.get("summary"));
    if (summary != null) result.put("summary", summary);

    return result;
  }

  private static Map<String, Object> readProvider(Map<?, ?> input, int index, List<String> errors) {
    var providerId = readString(input.get("providerId"), 64);
    var providerName = readString(input.get("providerName"), 128);
    var response = readString(input.get("response"), MAX_TEXT_LENGTH);
    var thinkResponse = readString(input.get("thinkResponse"), MAX_TEXT_LENGTH);

    if (providerId.isBlank()) errors.add("providers[" + index + "].providerId is required");
    if (providerName.isBlank()) errors.add("providers[" + index + "].providerName is required");
    if (response.isBlank() && thinkResponse.isBlank()) errors.add("providers[" + index + "] must include response or thinkResponse");
    if (providerId.isBlank() || providerName.isBlank() || (response.isBlank() && thinkResponse.isBlank())) return null;

    var provider = new LinkedHashMap<String, Object>();
    provider.put("providerId", providerId);
    provider.put("providerName", providerName);
    provider.put("status", "error".equals(input.get("status")) ? "error" : "completed");
    provider.put("response", response);
    if (!thinkResponse.isBlank()) provider.put("thinkResponse", thinkResponse);
    var stats = readStats(input.get("stats"));
    if (stats != null) provider.put("stats", stats);
    return provider;
  }

  private static Map<String, Object> readSummary(Object value) {
    if (!(value instanceof Map<?, ?> input)) return null;
    var response = readString(input.get("response"), MAX_TEXT_LENGTH);
    var thinkResponse = readString(input.get("thinkResponse"), MAX_TEXT_LENGTH);
    var analysisResponse = readString(input.get("analysisResponse"), MAX_TEXT_LENGTH);
    if (response.isBlank() && thinkResponse.isBlank() && analysisResponse.isBlank()) return null;

    var summary = new LinkedHashMap<String, Object>();
    summary.put("response", response);
    if (!thinkResponse.isBlank()) summary.put("thinkResponse", thinkResponse);
    if (!analysisResponse.isBlank()) summary.put("analysisResponse", analysisResponse);
    var stats = readStats(input.get("stats"));
    if (stats != null) summary.put("stats", stats);
    return summary;
  }

  private static Map<String, Object> readStats(Object value) {
    if (!(value instanceof Map<?, ?> input)) return null;
    var ttff = readNullableNumber(input.get("ttff"));
    var totalTime = readNullableNumber(input.get("totalTime"));
    var charCount = readNullableNumber(input.get("charCount"));
    var charsPerSec = readNullableNumber(input.get("charsPerSec"));
    if (ttff == null || totalTime == null || charCount == null || charsPerSec == null) return null;

    var stats = new LinkedHashMap<String, Object>();
    stats.put("ttff", ttff);
    stats.put("totalTime", totalTime);
    stats.put("charCount", charCount);
    stats.put("charsPerSec", charsPerSec);
    return stats;
  }

  private static String readString(Object value, int maxLength) {
    if (!(value instanceof String text)) return "";
    return text.length() > maxLength ? text.substring(0, maxLength) : text;
  }

  private static Number readNumber(Object value, Number fallback) {
    return value instanceof Number number ? number : fallback;
  }

  private static Number readNullableNumber(Object value) {
    return value instanceof Number number ? number : null;
  }

  private static String defaultTitle(String title, String question) {
    if (!title.isBlank()) return title;
    return question.length() > 80 ? question.substring(0, 80) : question;
  }
}
