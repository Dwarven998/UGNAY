package com.ugnay.ugnay.core.error;

/** 403: the caller is signed in but not allowed to do this. */
public class ForbiddenOperationException extends ApiException {

    public ForbiddenOperationException(String message) {
        super(ErrorCode.FORBIDDEN, message);
    }
}
