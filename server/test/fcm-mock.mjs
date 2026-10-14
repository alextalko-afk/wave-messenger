// Preloaded (node --import) into the server under test: replaces the Google
// OAuth token fetch and records every FCM request body to $FCM_LOG instead of
// calling the network.
import { appendFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';

GoogleAuth.prototype.getAccessToken = async () => 'fake-access-token';

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.includes('fcm.googleapis.com')) {
    appendFileSync(process.env.FCM_LOG, `${init.body}\n`);
    return new Response('{}', { status: 200 });
  }
  return realFetch(input, init);
};
