// Public, client-embedded configuration — this matches how the original single-page
// HTML version worked (no backend): the app is a fully static site, and these values
// ship inside the JS bundle. Security relies on restricting them at the provider side,
// not on hiding them:
//
// - STREETVIEW_KEY: restrict it in Google Cloud Console (APIs & Services > Credentials)
//   to an "HTTP referrers" restriction listing the domain(s) this site is deployed on,
//   and restrict the key to the Street View Static API only.
// - FIREBASE_CONFIG: Firebase web config is not a secret by design (see Firebase docs).
//   Access control for the group-battle rooms is enforced by the Realtime Database
//   security rules on the project itself (the original project used permissive
//   test-mode rules — tighten them in the Firebase console if you want to restrict
//   who can read/write rooms).

export const STREETVIEW_KEY = 'AIzaSyCThb7lihxBGAHMuXM86emh6Sgj79Ovdr4';

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAIN1ptwj0DJjFGt8g8EjQRLCK0gof7Up0',
  authDomain: 'mitikusa-kyoto.firebaseapp.com',
  databaseURL: 'https://mitikusa-kyoto-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'mitikusa-kyoto',
};
