package com.ugnay.ugnay.caption;

import java.util.ArrayList;
import java.util.List;

/**
 * Domain model representing an organization or personal workspace's AI profile,
 * used to frame captions and supply brand voice, hashtags, and grounding context.
 */
public record OrgAiProfile(
    String orgName,
    String fullName,
    String description,
    String audience,
    String focusAreas,
    String languagePref,
    String officialHashtags,
    String captionAvoid
) {
    public boolean hasDescription() {
        return description != null && !description.isBlank();
    }

    /** Formatted official hashtags as list of clean tags, e.g. ["#CCSUnited", "#ITWeek2026"] */
    public List<String> parsedOfficialHashtags() {
        if (officialHashtags == null || officialHashtags.isBlank()) {
            return List.of();
        }
        List<String> tags = new ArrayList<>();
        for (String part : officialHashtags.split("[\\s,]+")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                tags.add(trimmed.startsWith("#") ? trimmed : "#" + trimmed);
            }
        }
        return tags;
    }
}
