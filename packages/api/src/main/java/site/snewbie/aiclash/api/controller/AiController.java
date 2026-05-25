package site.snewbie.aiclash.api.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import site.snewbie.aiclash.api.exception.ApiException;
import site.snewbie.aiclash.api.service.AiProxyService;
import site.snewbie.aiclash.api.service.AuthService;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {
  private final AiProxyService aiProxyService;
  private final AuthService authService;

  public AiController(AiProxyService aiProxyService, AuthService authService) {
    this.aiProxyService = aiProxyService;
    this.authService = authService;
  }

  @GetMapping("/models")
  public Map<String, Object> models() {
    return aiProxyService.listModels();
  }

  @PostMapping("/chat/completions")
  public Object chatCompletions(
      @RequestBody Map<String, Object> body,
      HttpServletRequest request,
      HttpServletResponse response
  ) {
    if (authService.currentUser(request) == null) throw new ApiException(401, "login required");
    if (isStreamRequest(body)) {
      aiProxyService.streamChatCompletion(body, response);
      return null;
    }
    return aiProxyService.createChatCompletion(body);
  }

  private static boolean isStreamRequest(Map<String, Object> body) {
    return body != null && Boolean.TRUE.equals(body.get("stream"));
  }
}
