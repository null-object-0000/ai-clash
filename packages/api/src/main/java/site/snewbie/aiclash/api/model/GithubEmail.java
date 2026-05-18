package site.snewbie.aiclash.api.model;

public record GithubEmail(
    String email,
    boolean primary,
    boolean verified
) {}
