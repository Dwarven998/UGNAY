package com.ugnay.ugnay.facebook;

import com.ugnay.ugnay.core.error.LogSanitizer;

/**
 * Why a Facebook Page connection (OAuth callback) failed. Only the fixed {@link Reason#code()} and
 * {@link Reason#userMessage()} ever leave the server: the callback redirect must never carry an exception
 * message, because Graph request URLs contain the app secret, authorization code and access tokens.
 */
public class FacebookOAuthException extends RuntimeException {

    public enum Reason {
        CANCELLED("cancelled", "Facebook connection was cancelled."),
        MISSING_CODE("missing_code", "Facebook did not complete the connection. Please try connecting again."),
        INVALID_STATE("invalid_state",
            "This Facebook connection link is no longer valid. Please start the connection again from UGNAY."),
        NO_PAGE("no_page",
            "No Facebook Page connected: no Page was shared with UGNAY. Select a Page you manage during the connection, then try again."),
        ORGANIZATION_NOT_FOUND("org_not_found", "The organization for this connection no longer exists."),
        TOKEN_EXCHANGE_FAILED("token_exchange",
            "Facebook did not accept the connection request. Please try connecting again."),
        FACEBOOK_UNAVAILABLE("facebook_unavailable", "Facebook could not be reached. Please try again in a moment."),
        UNKNOWN("unknown", "Facebook connection failed. Please try again.");

        private final String code;
        private final String userMessage;

        Reason(String code, String userMessage) {
            this.code = code;
            this.userMessage = userMessage;
        }

        /** Stable, lower-case identifier sent to the frontend as {@code reason}. */
        public String code() {
            return code;
        }

        /** Fixed text that is safe to show to the user. */
        public String userMessage() {
            return userMessage;
        }
    }

    private final Reason reason;

    public FacebookOAuthException(Reason reason) {
        super(reason.userMessage());
        this.reason = reason;
    }

    /** The cause is stored scrubbed (see {@link LogSanitizer#scrub}), so logging this exception is safe. */
    public FacebookOAuthException(Reason reason, Throwable cause) {
        super(reason.userMessage(), LogSanitizer.scrub(cause));
        this.reason = reason;
    }

    public Reason getReason() {
        return reason;
    }
}
