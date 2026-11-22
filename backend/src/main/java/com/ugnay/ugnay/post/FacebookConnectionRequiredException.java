package com.ugnay.ugnay.post;

import com.ugnay.ugnay.core.error.ApiException;
import com.ugnay.ugnay.core.error.ErrorCode;

/** 428: the action needs a connected Facebook Page. */
public class FacebookConnectionRequiredException extends ApiException {

    public FacebookConnectionRequiredException(String message) {
        super(ErrorCode.FACEBOOK_CONNECTION_REQUIRED, message);
    }
}
