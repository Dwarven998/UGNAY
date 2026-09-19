package com.ugnay.ugnay.post;

/** Aggregated post counts and engagement for one organization or personal account, read in a single query. */
public interface PostTotals {
    long getTotalPosts();
    long getPublishedPosts();
    long getTotalEngagement();
}
