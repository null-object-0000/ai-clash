package site.snewbie.aiclash.api.model;

public record AuthIdentity(
    String provider,
    String providerLogin,
    String providerEmail,
    boolean providerEmailVerified,
    String providerDisplayName,
    String providerAvatarUrl
) {}
