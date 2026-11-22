/**
 * User-facing messages for the backend's error codes (backend: core/error/ErrorCode.java) and for
 * failures that never reached the backend. Keep the codes in sync with the backend enum; an unknown code
 * falls back to the message for its HTTP status.
 */

export const NETWORK_ERROR = 'NETWORK_ERROR';
export const TIMEOUT_ERROR = 'TIMEOUT';
export const UNEXPECTED_RESPONSE = 'UNEXPECTED_RESPONSE';

export const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  BAD_REQUEST: 'The request could not be processed. Please check your input and try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  MALFORMED_REQUEST: 'The request could not be read. Please try again.',
  MISSING_PARAMETER: 'Some required information is missing. Please try again.',
  SECURITY_VERIFICATION_FAILED: 'Security verification failed. Please complete the verification again.',
  UNAUTHORIZED: 'Please sign in to continue.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  AUTHENTICATION_FAILED: 'Sign-in failed. Please try again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  RESOURCE_NOT_FOUND: 'The requested resource could not be found.',
  METHOD_NOT_ALLOWED: 'This action is not supported.',
  NOT_ACCEPTABLE: 'This request is not supported.',
  RESOURCE_CONFLICT: 'This action conflicts with an existing record.',
  SCHEDULE_CONFLICT: 'Another post is already scheduled within 30 minutes of this time.',
  PAYLOAD_TOO_LARGE: 'The file is too large.',
  UNSUPPORTED_MEDIA_TYPE: 'This file type is not supported.',
  OPERATION_NOT_ALLOWED: 'This action is not allowed right now.',
  ACCOUNT_LOCKED: 'Too many failed attempts. Please try again later.',
  PRECONDITION_REQUIRED: 'A required step has not been completed yet.',
  FACEBOOK_CONNECTION_REQUIRED: 'Connect a Facebook Page first.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait before trying again.',
  AI_QUOTA_EXCEEDED: 'The AI assistant has reached its usage limit for now. Please wait a moment and try again.',
  INTERNAL_SERVER_ERROR: 'Something went wrong. Please try again later.',
  DATABASE_ERROR: 'Something went wrong. Please try again later.',
  EXTERNAL_SERVICE_ERROR: 'An external service returned an unexpected response. Please try again.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again in a moment.',
  EXTERNAL_SERVICE_UNAVAILABLE: 'An external service is temporarily unavailable. Please try again in a moment.',
  DATABASE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again in a moment.',
  EXTERNAL_SERVICE_TIMEOUT: 'An external service took too long to respond. Please try again.',
  [NETWORK_ERROR]: 'Unable to connect. Check your internet connection and try again.',
  [TIMEOUT_ERROR]: 'The server is taking too long to respond. Please try again.',
  [UNEXPECTED_RESPONSE]: 'The server sent an unexpected response. Please try again.',
};

/** Generic code for an HTTP status, used when the response carries no code (e.g. a proxy's HTML error page). */
export function codeForStatus(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'RESOURCE_NOT_FOUND';
    case 405: return 'METHOD_NOT_ALLOWED';
    case 409: return 'RESOURCE_CONFLICT';
    case 413: return 'PAYLOAD_TOO_LARGE';
    case 415: return 'UNSUPPORTED_MEDIA_TYPE';
    case 422: return 'VALIDATION_ERROR';
    case 423: return 'OPERATION_NOT_ALLOWED';
    case 428: return 'PRECONDITION_REQUIRED';
    case 429: return 'RATE_LIMIT_EXCEEDED';
    case 502: return 'EXTERNAL_SERVICE_ERROR';
    case 503: return 'SERVICE_UNAVAILABLE';
    case 504: return 'EXTERNAL_SERVICE_TIMEOUT';
    default: return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST';
  }
}

export function messageForCode(code: string | null | undefined, status = 0): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return ERROR_MESSAGES[status ? codeForStatus(status) : UNEXPECTED_RESPONSE];
}
