package site.snewbie.aiclash.api.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import site.snewbie.aiclash.api.service.AuthService;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  @GetMapping("/github/start")
  public ResponseEntity<Void> githubStart(@RequestParam(value = "returnTo", required = false) String returnTo) {
    return ResponseEntity.status(302).location(URI.create(authService.githubStartUrl(returnTo))).build();
  }

  @GetMapping("/microsoft/start")
  public ResponseEntity<Void> microsoftStart(@RequestParam(value = "returnTo", required = false) String returnTo) {
    return ResponseEntity.status(302).location(URI.create(authService.microsoftStartUrl(returnTo))).build();
  }

  @GetMapping("/google/start")
  public ResponseEntity<Void> googleStart(@RequestParam(value = "returnTo", required = false) String returnTo) {
    return ResponseEntity.status(302).location(URI.create(authService.googleStartUrl(returnTo))).build();
  }

  @GetMapping("/github/callback")
  public ResponseEntity<Void> githubCallback(
      @RequestParam("code") String code,
      @RequestParam("state") String state,
      HttpServletRequest request
  ) {
    var result = authService.githubCallback(code, state, request);
    return ResponseEntity.status(302)
        .header(HttpHeaders.SET_COOKIE, result.cookie().toString())
        .location(URI.create(result.returnTo()))
        .build();
  }

  @GetMapping("/microsoft/callback")
  public ResponseEntity<Void> microsoftCallback(
      @RequestParam(value = "code", required = false) String code,
      @RequestParam("state") String state,
      @RequestParam(value = "error", required = false) String error,
      @RequestParam(value = "error_description", required = false) String errorDescription,
      HttpServletRequest request
  ) {
    if (error != null && !error.isBlank()) {
      throw new site.snewbie.aiclash.api.exception.ApiException(401, errorDescription == null || errorDescription.isBlank() ? error : errorDescription);
    }
    var result = authService.microsoftCallback(code, state, request);
    return ResponseEntity.status(302)
        .header(HttpHeaders.SET_COOKIE, result.cookie().toString())
        .location(URI.create(result.returnTo()))
        .build();
  }

  @GetMapping("/google/callback")
  public ResponseEntity<Void> googleCallback(
      @RequestParam(value = "code", required = false) String code,
      @RequestParam("state") String state,
      @RequestParam(value = "error", required = false) String error,
      @RequestParam(value = "error_description", required = false) String errorDescription,
      HttpServletRequest request
  ) {
    if (error != null && !error.isBlank()) {
      throw new site.snewbie.aiclash.api.exception.ApiException(401, errorDescription == null || errorDescription.isBlank() ? error : errorDescription);
    }
    var result = authService.googleCallback(code, state, request);
    return ResponseEntity.status(302)
        .header(HttpHeaders.SET_COOKIE, result.cookie().toString())
        .location(URI.create(result.returnTo()))
        .build();
  }

  @GetMapping("/me")
  public Map<String, Object> me(HttpServletRequest request) {
    var user = authService.currentUser(request);
    if (user == null) return Map.of("authenticated", false);
    var userPayload = new LinkedHashMap<String, Object>();
    userPayload.put("id", user.id());
    userPayload.put("displayName", user.displayName());
    userPayload.put("avatarUrl", user.avatarUrl());
    userPayload.put("status", user.status());
    userPayload.put("email", user.email());
    userPayload.put("provider", user.provider());
    userPayload.put("providerLogin", user.providerLogin());
    userPayload.put("identities", authService.currentUserIdentities(user.id()).stream().map(identity -> {
      var identityPayload = new LinkedHashMap<String, Object>();
      identityPayload.put("provider", identity.provider());
      identityPayload.put("providerLogin", identity.providerLogin());
      identityPayload.put("providerEmail", identity.providerEmail());
      identityPayload.put("providerEmailVerified", identity.providerEmailVerified());
      identityPayload.put("providerDisplayName", identity.providerDisplayName());
      identityPayload.put("providerAvatarUrl", identity.providerAvatarUrl());
      return identityPayload;
    }).toList());

    var response = new LinkedHashMap<String, Object>();
    response.put("authenticated", true);
    response.put("user", userPayload);
    return response;
  }

  @PostMapping("/logout")
  public ResponseEntity<Map<String, Object>> logout(HttpServletRequest request) {
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, authService.logoutCookie(request).toString())
        .body(Map.of("ok", true));
  }

  @PatchMapping("/profile")
  public Map<String, Object> updateProfile(
      @RequestBody Map<String, Object> body,
      HttpServletRequest request
  ) {
    authService.updateProfile(request, body);
    return Map.of("ok", true);
  }

}
