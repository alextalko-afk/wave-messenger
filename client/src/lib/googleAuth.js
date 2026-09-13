// The "Web application" OAuth client ID from Google Cloud Console
// (Credentials -> OAuth client ID -> Web application) - same one used by
// the backend (GOOGLE_CLIENT_ID env var) and the Android app
// (google_web_client_id in strings.xml). Client IDs are public identifiers,
// safe to ship in frontend code - the secret half never leaves the backend.
export const GOOGLE_CLIENT_ID = '102793506258-1hrii748vubehmm05haftbr4ove278nt.apps.googleusercontent.com';

function waitForGoogleSdk() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        resolve(window.google);
      } else if (Date.now() - start > 8000) {
        clearInterval(interval);
        reject(new Error('Не удалось загрузить Google SDK'));
      }
    }, 100);
  });
}

/** Renders the official Google "Sign in with Google" button into `container` and resolves with the ID token once the user picks an account. */
export function renderGoogleButton(container, { onCredential, onError }) {
  waitForGoogleSdk()
    .then((google) => {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: container.offsetWidth || 320,
      });
    })
    .catch((err) => onError?.(err.message));
}
