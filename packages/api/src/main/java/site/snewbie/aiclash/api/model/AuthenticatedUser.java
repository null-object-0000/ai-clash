package site.snewbie.aiclash.api.model;

public record AuthenticatedUser(
    long id,
    String displayName,
    String avatarUrl,
    String status,
    String email,
    String provider,
    String providerLogin
) {}
