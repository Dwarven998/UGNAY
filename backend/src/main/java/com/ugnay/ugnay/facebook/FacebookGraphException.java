package com.ugnay.ugnay.facebook;

/**
 * A failed Facebook Graph call made by {@link FacebookOAuthService}. The message and the (scrubbed) cause
 * contain no credentials, unlike the original {@code WebClientResponseException}, whose message embeds the
 * request URL with {@code client_secret} / {@code access_token}.
 */
public class FacebookGraphException extends RuntimeException {

    /** HTTP status Facebook answered with, or 0 when no response arrived (network error, timeout). */
    private final int status;
    private final boolean timeout;

    public FacebookGraphException(int status, boolean timeout, String message, Throwable scrubbedCause) {
        super(message, scrubbedCause);
        this.status = status;
        this.timeout = timeout;
    }

    public int getStatus() {
        return status;
    }

    public boolean isTimeout() {
        return timeout;
    }

    /** True when Facebook did not answer usefully: no response, a timeout, or a 5xx. */
    public boolean isUnavailable() {
        return status == 0 || timeout || status >= 500;
    }
}
