import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function readLocalEnv() {
  try {
    const source = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || Object.hasOwn(process.env, match[1])) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value || /YOUR-|PLACEHOLDER|CHANGE_ME/i.test(value)) throw new Error(`${name} is missing or still a placeholder.`);
  return value;
}

function accountFrom(prefix, username, role, label, emailDomain) {
  const configuredEmail = process.env[`${prefix}_EMAIL`]?.trim();
  const email = (configuredEmail || `${username}@${emailDomain}`).toLowerCase();
  const password = required(`${prefix}_PASSWORD`);
  const fullName = process.env[`${prefix}_FULL_NAME`]?.trim() || label;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${prefix}_EMAIL is not a valid email address.`);
  if (password.length < 12) throw new Error(`${prefix}_PASSWORD must be at least 12 characters.`);
  return { email, password, fullName, role, label };
}

async function findAuthUser(admin, email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list Supabase Auth users: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
}

async function main() {
  readLocalEnv();
  const url = process.env.SUPABASE_URL?.trim() || required('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
  const emailDomain = (process.env.SETUP_EMAIL_DOMAIN?.trim() || 'student.local').toLowerCase();
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(emailDomain)) {
    throw new Error('SETUP_EMAIL_DOMAIN must be a valid email domain without an @ symbol.');
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const accounts = [
    accountFrom('SETUP_SUPER_ADMIN', 'superadmin', 'SUPER_ADMIN', 'Super Admin', emailDomain),
    accountFrom('SETUP_WORKING_SCHOLAR_ADMIN', 'workingscholar', 'WORKING_SCHOLAR_ADMIN', 'Working Scholar Admin', emailDomain),
    accountFrom('SETUP_FINANCE_ADMIN', 'financeadmin', 'FINANCE_ADMIN', 'Finance Admin', emailDomain),
    accountFrom('SETUP_STUDENT', 'acdstudent', 'STUDENT', 'Student', emailDomain),
  ];
  if (new Set(accounts.map(({ email }) => email)).size !== accounts.length) {
    throw new Error('Each role must use a distinct email address.');
  }

  const results = [];
  for (const account of accounts) {
    let user = await findAuthUser(admin, account.email);
    let created = false;
    if (!user) {
      const result = await admin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName },
        app_metadata: { require_password_change: true },
      });
      if (result.error || !result.data.user) {
        throw new Error(`Could not create Supabase Auth user ${account.email}: ${result.error?.message ?? 'unknown error'}`);
      }
      user = result.data.user;
      created = true;
    } else if (process.env.RESET_EXISTING_ACCOUNT_PASSWORDS === 'true') {
      const result = await admin.auth.admin.updateUserById(user.id, {
        password: account.password,
        email_confirm: true,
        user_metadata: { ...user.user_metadata, full_name: account.fullName },
        app_metadata: { ...user.app_metadata, require_password_change: true },
      });
      if (result.error) throw new Error(`Could not update the password for ${account.email}: ${result.error.message}`);
      user = result.data.user;
    }

    const { data: currentProfile, error: profileLookupError } = await admin
      .from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profileLookupError) {
      if (created) await admin.auth.admin.deleteUser(user.id);
      throw new Error(`Could not read public.profiles for ${account.email}. Apply schema.sql and role-expansion.sql first. ${profileLookupError.message}`);
    }
    if (currentProfile && currentProfile.role !== account.role) {
      if (created) await admin.auth.admin.deleteUser(user.id);
      throw new Error(`${account.email} already has role ${currentProfile.role}; refusing to silently reassign it to ${account.role}.`);
    }

    const profileValues = {
      id: user.id,
      email: account.email,
      full_name: account.fullName,
      role: account.role,
    };
    const profileWrite = currentProfile
      ? admin.from('profiles').update(profileValues).eq('id', user.id)
      : admin.from('profiles').insert({ ...profileValues, is_active: true });
    const { error: profileError } = await profileWrite;
    if (profileError) {
      if (created) await admin.auth.admin.deleteUser(user.id);
      throw new Error(`Could not provision the profile for ${account.email}: ${profileError.message}`);
    }
    results.push({ email: account.email, role: account.role, auth: created ? 'created' : 'already existed', profile: 'ready' });
  }

  for (const result of results) {
    console.log(`${result.auth}: ${result.email} (${result.role}), profile ${result.profile}`);
  }
  console.log('Account passwords are the values configured in .env.local. Passwords were not printed.');
}

main().catch((error) => {
  console.error(`Account setup failed: ${error.message}`);
  process.exitCode = 1;
});
