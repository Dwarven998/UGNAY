package com.ugnay.ugnay.core.error;

/** 404: the resource does not exist or is outside the caller's scope (deliberately indistinguishable). */
public class ResourceNotFoundException extends ApiException {

    public ResourceNotFoundException(String message) {
        super(ErrorCode.RESOURCE_NOT_FOUND, message);
    }
}
