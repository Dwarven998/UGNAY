package com.ugnay.ugnay.post;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class PostApiExceptionHandler {

    @ExceptionHandler(SchedulingConflictException.class)
    public ResponseEntity<PostConflictDto> handleSchedulingConflict(SchedulingConflictException exception) {
        return ResponseEntity.status(409).body(exception.getConflict());
    }
}