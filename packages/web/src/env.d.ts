interface ImportMetaEnv {
  /** Public address of the app, from PUBLIC_URL in .env. Empty when not set. */
  readonly PUBLIC_URL: string;
  /** This machine's address on the local network, filled in by the dev server. */
  readonly LAN_URL: string;
}
