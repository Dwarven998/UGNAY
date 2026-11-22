package com.ugnay.ugnay.core.error;

import java.util.List;

/** 400: input that passed binding but is not acceptable (checked in code rather than by annotations). */
public class RequestValidationException extends ApiException {

    public RequestValidationException(String message) {
        super(ErrorCode.VALIDATION_ERROR, message);
    }

    public RequestValidationException(String message, List<ApiErrorResponse.FieldErrorDetail> details) {
        super(ErrorCode.VALIDATION_ERROR, message, null, details);
    }
}
