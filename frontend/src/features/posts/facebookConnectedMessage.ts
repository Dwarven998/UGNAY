/**
 * Message shown after the Facebook OAuth round-trip succeeds. The backend adds the approving Facebook user's
 * name (`fbUser`) and the connected Page's name (`page`) to the redirect, so this reads
 * "<Facebook user> has been connected to <Page name>." (Facebook's own dialog can only name the Meta app.)
 */
export function facebookConnectedMessage(params: URLSearchParams): string {
  const page = params.get('page')?.trim();
  const fbUser = params.get('fbUser')?.trim();
  if (page && fbUser) return `${fbUser} has been connected to ${page}. You can now publish and schedule posts.`;
  if (page) return `${page} has been connected. You can now publish and schedule posts.`;
  return 'Facebook Page connected. You can now publish and schedule posts.';
}

/**
 * Message for a failed connection, chosen by the fixed `reason` code the backend puts on the redirect
 * (see FacebookOAuthException.Reason). The free-text `message` parameter is deliberately not displayed:
 * anyone can craft a link with arbitrary text in it.
 */
const FACEBOOK_FAILURE_MESSAGES: Readonly<Record<string, string>> = {
  cancelled: 'Facebook connection was cancelled.',
  missing_code: 'Facebook did not complete the connection. Please try connecting again.',
  invalid_state: 'This Facebook connection link is no longer valid. Please start the connection again from UGNAY.',
  no_page:
    'No Facebook Page connected: no Page was shared with UGNAY. Select a Page you manage during the connection, then try again.',
  org_not_found: 'The organization for this connection no longer exists.',
  token_exchange: 'Facebook did not accept the connection request. Please try connecting again.',
  facebook_unavailable: 'Facebook could not be reached. Please try again in a moment.',
  unknown: 'Facebook connection failed. Please try again.',
};

export function facebookFailureMessage(params: URLSearchParams): string {
  const reason = params.get('reason');
  return (reason && FACEBOOK_FAILURE_MESSAGES[reason]) || FACEBOOK_FAILURE_MESSAGES.unknown;
}
