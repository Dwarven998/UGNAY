package com.ugnay.ugnay.post;

import java.util.UUID;

public record PostConflictDto(
    UUID postId,
    String caption,
    String scheduledAt,
    String status,
    String mediaUrl
) {}