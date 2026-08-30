package com.ugnay.ugnay.post;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class PostApiExceptionHandler {

    @ExceptionHandler(SchedulingConflictException.class)
    public ResponseEntity<PostConflictDto> handleSchedulingConflict(SchedulingConflictException exception) {
        return ResponseEntity.status(409).body(exception.getConflict());
    }

    @ExceptionHandler(FacebookConnectionRequiredException.class)
    public ResponseEntity<Map<String, String>> handleFacebookConnectionRequired(FacebookConnectionRequiredException exception) {
        return ResponseEntity.status(428).body(Map.of("message", exception.getMessage()));
    }

    // Covers business-rule violations such as the appeal/edit-lock checks in PostSchedulerService
    // (e.g. "request an edit appeal before changing it") so their message reaches the frontend
    // instead of being swallowed by Spring's default "No message available" error body.
    // 423 Locked (not 409) so this doesn't collide with the frontend's scheduling-conflict handling,
    // which specifically expects a PostConflict body on 409.
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException exception) {
        return ResponseEntity.status(423).body(Map.of("message", exception.getMessage()));
    }
}