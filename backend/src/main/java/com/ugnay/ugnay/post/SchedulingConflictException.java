package com.ugnay.ugnay.post;

public class SchedulingConflictException extends RuntimeException {

    private final PostConflictDto conflict;

    public SchedulingConflictException(PostConflictDto conflict) {
        super("Schedule conflict detected within 30 minutes of an existing scheduled post");
        this.conflict = conflict;
    }

    public PostConflictDto getConflict() {
        return conflict;
    }
}