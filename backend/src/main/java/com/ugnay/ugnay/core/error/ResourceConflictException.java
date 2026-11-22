package com.ugnay.ugnay.core.error;

/** 409: the request conflicts with existing data (e.g. a duplicate). */
public class ResourceConflictException extends ApiException {

    public ResourceConflictException(String message) {
        super(ErrorCode.RESOURCE_CONFLICT, message);
    }

    public ResourceConflictException(String message, Throwable cause) {
        super(ErrorCode.RESOURCE_CONFLICT, message, cause);
    }
}
