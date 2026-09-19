package com.ugnay.ugnay.analytics;

import java.util.List;

/** Response shapes for the Analytics dashboard and the per-post insights page. */
public final class AnalyticsDtos {

    private AnalyticsDtos() {}

    /** A headline number with its value for the previous period of the same length. */
    public record Trend(long value, long previous, Integer changePercent) {}

    public record DayPoint(String date, long value) {}

    public record Kpis(long totalPosts, long publishedPosts, long totalEngagement, double avgEngagement) {}

    public record Overview(
        Trend views,
        Trend threeSecondViews,
        Trend interactions,
        Trend watchTimeSeconds,
        Long viewers,
        List<DayPoint> viewsSeries,
        List<DayPoint> threeSecondViewsSeries,
        List<DayPoint> interactionsSeries,
        List<DayPoint> watchTimeSeries,
        String periodStart,
        String periodEnd
    ) {}

    public record ContentItem(
        String id,
        String message,
        String createdTime,
        String permalinkUrl,
        String imageUrl,
        String format,
        Long views,
        long reactions,
        long comments,
        long shares
    ) {}

    public record FormatStat(String key, String label, int published, long views, long interactions) {}

    public record Dashboard(
        boolean connected,
        int days,
        Kpis kpis,
        Overview overview,
        List<ContentItem> content,
        List<FormatStat> formats,
        boolean viewsAvailable,
        List<String> warnings,
        long fetchedAt
    ) {}

    public record SeriesPoint(long t, long views) {}

    public record Comment(
        String id,
        String message,
        String createdTime,
        String authorName,
        String authorId,
        String authorPicture,
        long likeCount,
        String permalinkUrl,
        String attachmentUrl,
        List<Comment> replies
    ) {}

    public record PostDetail(
        String id,
        String message,
        String createdTime,
        String permalinkUrl,
        String imageUrl,
        String format,
        Long views,
        Long viewers,
        Long linkClicks,
        long interactions,
        long reactions,
        long comments,
        long shares,
        List<SeriesPoint> series,
        String trackingSince,
        Long typicalViews,
        String comparison,
        List<Comment> commentList,
        boolean commentsComplete,
        boolean viewsAvailable,
        long fetchedAt
    ) {}
}
