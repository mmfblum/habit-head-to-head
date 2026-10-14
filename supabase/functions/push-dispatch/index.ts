import { createClient } from 'npm:@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose@6';

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
}

interface PushTokenRecord {
  id: string;
  platform: 'ios' | 'android';
  token: string;
}

interface FirebaseServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const dispatchSecret = Deno.env.get('ZRIZIN_PUSH_DISPATCH_SECRET') ?? '';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function notificationPath(type: string) {
  if (/matchup|taunt|lead|tie|power.?play/i.test(type)) return '/matchup';
  if (/feed|reaction/i.test(type)) return '/feed';
  if (/punishment|standings|leaderboard|season|week/i.test(type)) return '/league';
  return '/notifications';
}

function requireDispatchSecret(request: Request) {
  if (!dispatchSecret) throw new Error('ZRIZIN_PUSH_DISPATCH_SECRET is not configured');
  const supplied = request.headers.get('x-zrizin-push-secret') ?? '';
  if (supplied.length !== dispatchSecret.length) return false;

  // Constant-time comparison without leaking the configured secret.
  let mismatch = 0;
  for (let index = 0; index < supplied.length; index += 1) {
    mismatch |= supplied.charCodeAt(index) ^ dispatchSecret.charCodeAt(index);
  }
  return mismatch === 0;
}

async function loadNotification(request: Request): Promise<NotificationRecord> {
  const payload = await request.json().catch(() => ({})) as {
    notification_id?: string;
    record?: Partial<NotificationRecord>;
  };

  const id = payload.notification_id ?? payload.record?.id;
  if (!id) throw new Error('notification_id is required');

  const { data, error } = await supabase
    .from('user_notifications')
    .select('id,user_id,type,title,body')
    .eq('id', id)
    .single();

  if (error || !data) throw new Error('Notification not found');
  return data as NotificationRecord;
}

async function loadTokens(userId: string): Promise<PushTokenRecord[]> {
  const { data, error } = await supabase
    .from('device_push_tokens')
    .select('id,platform,token')
    .eq('user_id', userId)
    .eq('enabled', true);

  if (error) throw error;
  return (data ?? []) as PushTokenRecord[];
}

async function disableToken(tokenId: string) {
  await supabase
    .from('device_push_tokens')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('id', tokenId);
}

async function getFirebaseAccessToken() {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');

  const credentials = JSON.parse(raw) as FirebaseServiceAccount;
  const tokenUri = credentials.token_uri ?? 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(credentials.private_key.replace(/\\n/g, '\n'), 'RS256');
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(credentials.client_email)
    .setSubject(credentials.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) throw new Error(`Firebase OAuth failed (${response.status})`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Firebase OAuth returned no access token');
  return { accessToken: data.access_token, projectId: credentials.project_id };
}

async function sendAndroid(
  target: PushTokenRecord,
  notification: NotificationRecord,
  firebaseAuth: { accessToken: string; projectId: string },
) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(firebaseAuth.projectId)}/messages:send`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${firebaseAuth.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: target.token,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: {
            notification_id: notification.id,
            path: notificationPath(notification.type),
            type: notification.type,
          },
          android: {
            priority: 'high',
          },
        },
      }),
    },
  );

  if (response.ok) return { ok: true, status: response.status };

  const errorText = await response.text();
  if (response.status === 404 || /UNREGISTERED/i.test(errorText)) {
    await disableToken(target.id);
  }
  return { ok: false, status: response.status, error: errorText.slice(0, 500) };
}

async function createApnsProviderToken() {
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const privateKeyRaw = Deno.env.get('APNS_PRIVATE_KEY');
  if (!teamId || !keyId || !privateKeyRaw) {
    throw new Error('APNs token credentials are not configured');
  }

  const privateKey = await importPKCS8(privateKeyRaw.replace(/\\n/g, '\n'), 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(privateKey);
}

async function sendIos(
  target: PushTokenRecord,
  notification: NotificationRecord,
  providerToken: string,
) {
  const topic = Deno.env.get('APNS_TOPIC') ?? 'com.zrizin.app';
  const environment = Deno.env.get('APNS_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';
  const host = environment === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';

  const response = await fetch(`${host}/3/device/${encodeURIComponent(target.token)}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${providerToken}`,
      'apns-topic': topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: notification.title,
          body: notification.body,
        },
        sound: 'default',
      },
      notification_id: notification.id,
      path: notificationPath(notification.type),
      type: notification.type,
    }),
  });

  if (response.ok) return { ok: true, status: response.status };

  const errorText = await response.text();
  if (response.status === 410 || /BadDeviceToken|Unregistered/i.test(errorText)) {
    await disableToken(target.id);
  }
  return { ok: false, status: response.status, error: errorText.slice(0, 500) };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!requireDispatchSecret(request)) return new Response('Unauthorized', { status: 401 });

  try {
    const notification = await loadNotification(request);
    const tokens = await loadTokens(notification.user_id);
    if (tokens.length === 0) {
      return Response.json({ delivered: 0, attempted: 0 });
    }

    const androidTargets = tokens.filter((token) => token.platform === 'android');
    const iosTargets = tokens.filter((token) => token.platform === 'ios');
    const results: unknown[] = [];

    if (androidTargets.length > 0) {
      const firebaseAuth = await getFirebaseAccessToken();
      results.push(...await Promise.all(
        androidTargets.map((target) => sendAndroid(target, notification, firebaseAuth)),
      ));
    }

    if (iosTargets.length > 0) {
      const providerToken = await createApnsProviderToken();
      results.push(...await Promise.all(
        iosTargets.map((target) => sendIos(target, notification, providerToken)),
      ));
    }

    const delivered = results.filter((result) => (result as { ok?: boolean }).ok).length;
    return Response.json({ delivered, attempted: tokens.length, results });
  } catch (error) {
    console.error('Push dispatch failed', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Push dispatch failed' },
      { status: 500 },
    );
  }
});
