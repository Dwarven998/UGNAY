package com.ugnay.ugnay.core.error;

/**
 * 423 Locked: a business rule forbids the action in the resource's current state (e.g. "Only pending posts can
 * be approved or rejected"). 423 rather than 409 keeps it apart from the frontend's scheduling-conflict
 * handling, which expects a post-conflict body on 409.
 */
public class BusinessRuleException extends ApiException {

    public BusinessRuleException(String message) {
        super(ErrorCode.OPERATION_NOT_ALLOWED, message);
    }
}
