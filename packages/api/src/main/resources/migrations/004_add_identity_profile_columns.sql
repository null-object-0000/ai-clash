ALTER TABLE user_identities
  ADD COLUMN provider_display_name VARCHAR(100) NULL,
  ADD COLUMN provider_avatar_url VARCHAR(500) NULL;

UPDATE user_identities
   SET provider_display_name = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile, '$.name')), ''),
       provider_avatar_url = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(profile, '$.avatarUrl')), '')
 WHERE profile IS NOT NULL;
