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
