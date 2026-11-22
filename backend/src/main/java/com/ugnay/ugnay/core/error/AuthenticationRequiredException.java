package com.ugnay.ugnay.core.error;

/** 401: the request needs a signed-in user and has none. */
public class AuthenticationRequiredException extends ApiException {

    public AuthenticationRequiredException() {
        super(ErrorCode.UNAUTHORIZED);
    }

    /**
     * Returns the principal, or throws 401 when it is null. For endpoints under the public {@code /api/auth/**}
     * prefix, where Spring Security lets anonymous requests through and {@code @AuthenticationPrincipal} is null.
     */
    public static <T> T requireAuthenticated(T principal) {
        if (principal == null) {
            throw new AuthenticationRequiredException();
        }
        return principal;
    }
}
