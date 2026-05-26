-- Create Supabase Auth users from pengguna table
-- Maps local POS users to Supabase Auth accounts

DO $$
DECLARE
  user_id uuid;
  user_email text;
  user_password text;
  pass_hash text;
BEGIN
  -- admin / admin123
  user_email := 'admin@sobats.com';
  user_password := 'admin123';
  pass_hash := crypt(user_password, gen_salt('bf', 10));
  user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated',
    user_email, pass_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"admin","role":"ADMIN"}',
    now(), now(), '', '', '', '', false, false
  );

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at,
    created_at, updated_at, id
  ) VALUES (
    user_id, user_id,
    jsonb_build_object('sub', user_id, 'email', user_email, 'email_verified', true),
    'email', now(), now(), now(), user_id
  );

  -- kasir1 / kasir123
  user_email := 'kasir1@sobats.com';
  user_password := 'kasir123';
  pass_hash := crypt(user_password, gen_salt('bf', 10));
  user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated',
    user_email, pass_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"kasir1","role":"KASIR"}',
    now(), now(), '', '', '', '', false, false
  );

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at,
    created_at, updated_at, id
  ) VALUES (
    user_id, user_id,
    jsonb_build_object('sub', user_id, 'email', user_email, 'email_verified', true),
    'email', now(), now(), now(), user_id
  );

  -- kasir2 / kasir123
  user_email := 'kasir2@sobats.com';
  user_password := 'kasir123';
  pass_hash := crypt(user_password, gen_salt('bf', 10));
  user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated',
    user_email, pass_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"kasir2","role":"KASIR"}',
    now(), now(), '', '', '', '', false, false
  );

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at,
    created_at, updated_at, id
  ) VALUES (
    user_id, user_id,
    jsonb_build_object('sub', user_id, 'email', user_email, 'email_verified', true),
    'email', now(), now(), now(), user_id
  );

  -- owner / owner123
  user_email := 'owner@sobats.com';
  user_password := 'owner123';
  pass_hash := crypt(user_password, gen_salt('bf', 10));
  user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token, is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated',
    user_email, pass_hash, now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"owner","role":"OWNER"}',
    now(), now(), '', '', '', '', false, false
  );

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at,
    created_at, updated_at, id
  ) VALUES (
    user_id, user_id,
    jsonb_build_object('sub', user_id, 'email', user_email, 'email_verified', true),
    'email', now(), now(), now(), user_id
  );

END $$;
