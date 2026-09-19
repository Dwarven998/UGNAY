package com.ugnay.ugnay.analytics;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Tiny per-key cache with request coalescing: concurrent callers for the same key share one load,
 * and a value is reused for {@code ttl}. Keeps several open browser tabs from multiplying Graph API calls.
 * Failed loads are never cached.
 */
final class TtlCache<T> {

    private record Entry<T>(CompletableFuture<T> future, long expiresAtNanos) {}

    private final ConcurrentHashMap<String, Entry<T>> entries = new ConcurrentHashMap<>();
    private final long ttlNanos;

    TtlCache(Duration ttl) {
        this.ttlNanos = ttl.toNanos();
    }

    T get(String key, Supplier<T> loader) {
        long now = System.nanoTime();
        CompletableFuture<T> mine = new CompletableFuture<>();
        Entry<T> fresh = new Entry<>(mine, now + ttlNanos);
        Entry<T> entry = entries.compute(key, (k, old) ->
            old != null && (!old.future().isDone() || old.expiresAtNanos() > now) ? old : fresh);

        if (entry == fresh) {
            try {
                mine.complete(loader.get());
            } catch (Throwable t) {
                entries.remove(key, fresh);
                mine.completeExceptionally(t);
            }
        }
        try {
            return entry.future().join();
        } catch (CompletionException ex) {
            entries.remove(key, entry);
            if (ex.getCause() instanceof RuntimeException runtime) throw runtime;
            throw ex;
        } finally {
            if (entries.size() > 500) {
                long cutoff = System.nanoTime();
                entries.entrySet().removeIf(e -> e.getValue().future().isDone() && e.getValue().expiresAtNanos() < cutoff);
            }
        }
    }
}
