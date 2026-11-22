package com.ugnay.ugnay.core.error;

import java.time.Duration;

import org.springframework.http.HttpHeaders;

/** 429 with a Retry-After header telling the client how long to wait. */
public class RateLimitExceededException extends ApiException {

    private final Duration retryAfter;

    public RateLimitExceededException(String message, Duration retryAfter) {
        super(ErrorCode.RATE_LIMIT_EXCEEDED, message);
        this.retryAfter = retryAfter;
    }

    public Duration getRetryAfter() {
        return retryAfter;
    }

    @Override
    public HttpHeaders getHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.putAll(super.getHeaders());
        if (retryAfter != null) {
            headers.set(HttpHeaders.RETRY_AFTER, String.valueOf(Math.max(1, retryAfter.toSeconds())));
        }
        return headers;
    }
}
