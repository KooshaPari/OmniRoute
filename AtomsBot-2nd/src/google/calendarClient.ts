import { google } from 'googleapis';
import { secretsStore } from '../settings/SecretsStore';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export async function getOAuthConfig(): Promise<OAuthConfig> {
  const [cid, cs, ru] = await Promise.all([
    secretsStore.get('google_client_id'),
    secretsStore.get('google_client_secret'),
    secretsStore.get('google_redirect_uri'),
  ]);
  const clientId = cid || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = cs || process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = ru || process.env.GOOGLE_REDIRECT_URI || '';
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth config: GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI');
  }
  return { clientId, clientSecret, redirectUri };
}

export async function createOAuthClient(creds?: Partial<OAuthConfig>) {
  const cfg = { ...(await getOAuthConfig()), ...creds };
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

export async function getScopes(): Promise<string[]> {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
  ];
  const driveFlag = (await secretsStore.get('google_enable_drive_readonly')) || process.env.GOOGLE_ENABLE_DRIVE_READONLY;
  if (driveFlag === 'true') {
    scopes.push('https://www.googleapis.com/auth/drive.readonly');
  }
  return scopes;
}

export async function getAuthUrl(): Promise<string> {
  const oauth2Client = await createOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: await getScopes(),
  });
  return url;
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = await createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2('v2');
  const me = await oauth2.userinfo.get({ auth: oauth2Client });
  return { tokens, email: me.data.email || '' };
}

export async function createCalendarClientFromRefreshToken(refreshToken: string) {
  const oauth2Client = await createOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  return { calendar, auth: oauth2Client };
}
