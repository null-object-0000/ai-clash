package site.snewbie.aiclash.api.model;

public record OAuthUserProfile(
    String provider,
    String id,
    String login,
    String name,
    String avatarUrl,
    String email,
    boolean emailVerified
) {}
