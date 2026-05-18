package site.snewbie.aiclash.api.model;

public record GithubUser(
    String id,
    String login,
    String name,
    String avatarUrl,
    String email
) {}
