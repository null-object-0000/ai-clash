package site.snewbie.aiclash.api.controller;

import jakarta.servlet.http.HttpServletRequest;
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
  public Map<String, Object> chatCompletions(
      @RequestBody Map<String, Object> body,
      HttpServletRequest request
  ) {
    if (authService.currentUser(request) == null) throw new ApiException(401, "login required");
    return aiProxyService.createChatCompletion(body);
  }
}
