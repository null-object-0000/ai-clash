package site.snewbie.aiclash.api.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import site.snewbie.aiclash.api.config.AppProperties;
import site.snewbie.aiclash.api.exception.ApiException;
import site.snewbie.aiclash.api.service.ShareService;

import java.util.Map;

@RestController
@RequestMapping("/api/shares")
public class ShareController {
  private final ShareService shareService;
  private final AppProperties properties;

  public ShareController(ShareService shareService, AppProperties properties) {
    this.shareService = shareService;
    this.properties = properties;
  }

  @PostMapping
  public ResponseEntity<Map<String, Object>> createShare(
      @RequestBody Map<String, Object> body,
      HttpServletRequest request
  ) {
    if (request.getContentLengthLong() > properties.maxShareBytes()) {
      throw new ApiException(413, "share payload is too large");
    }
    var response = shareService.createShare(body);
    var status = Boolean.TRUE.equals(response.get("existing")) ? HttpStatus.OK : HttpStatus.CREATED;
    return ResponseEntity.status(status).body(response);
  }

  @GetMapping("/{id}")
  public Map<String, Object> getShare(@PathVariable String id) {
    return shareService.getShare(id);
  }

  @DeleteMapping("/{id}")
  public Map<String, Object> deleteShare(
      @PathVariable String id,
      @RequestHeader(value = "x-delete-token", required = false) String deleteToken
  ) {
    return shareService.deleteShare(id, deleteToken);
  }
}
