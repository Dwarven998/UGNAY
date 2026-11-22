package com.ugnay.ugnay.core.error;

/**
 * A third-party service (Facebook, Gemini, storage, email, Turnstile, Google) failed or is unavailable. Its
 * status is 502 (bad answer), 503 (unavailable), 504 (timeout) or 429 (quota), taken from the {@link ErrorCode}.
 * The cause is stored scrubbed so that logging it cannot reveal credentials carried in request URLs.
 */
public class ExternalServiceException extends ApiException {

    public enum Service { FACEBOOK, GEMINI, STORAGE, EMAIL, TURNSTILE, GOOGLE }

    private final Service service;

    public ExternalServiceException(Service service, ErrorCode code, String message) {
        this(service, code, message, null);
    }

    public ExternalServiceException(Service service, ErrorCode code, String message, Throwable cause) {
        super(code, message, cause == null ? null : LogSanitizer.scrub(cause));
        this.service = service;
    }

    public Service getService() {
        return service;
    }
}
