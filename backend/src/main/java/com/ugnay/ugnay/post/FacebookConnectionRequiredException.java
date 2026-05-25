package com.ugnay.ugnay.post;

public class FacebookConnectionRequiredException extends RuntimeException {

    public FacebookConnectionRequiredException(String message) {
        super(message);
    }
}