package com.ugnay.ugnay.post;

import com.ugnay.ugnay.core.error.ApiException;
import com.ugnay.ugnay.core.error.ErrorCode;

/** 409: another post is scheduled within 30 minutes. The response body carries the conflicting post. */
public class SchedulingConflictException extends ApiException {

    private final transient PostConflictDto conflict;

    public SchedulingConflictException(PostConflictDto conflict) {
        super(ErrorCode.SCHEDULE_CONFLICT, "Schedule conflict detected within 30 minutes of an existing scheduled post");
        this.conflict = conflict;
    }

    public PostConflictDto getConflict() {
        return conflict;
    }
}
