package com.ugnay.ugnay.core;

import java.time.Duration;

import org.springframework.http.client.reactive.ReactorClientHttpConnector;

import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

/**
 * HTTP connector for outbound calls (Facebook Graph, Gemini, Supabase Storage).
 *
 * Those servers close idle keep-alive connections on their side after a short while. Reactor Netty's default
 * pool keeps them around and hands one back out, and the request then fails with "Connection reset" and only
 * succeeds after a retry and its back-off — which is what made pages and caption generation stall at random.
 * This pool drops idle connections before the servers do.
 */
public final class PooledHttpConnector {

    private PooledHttpConnector() {
    }

    public static ReactorClientHttpConnector create(String name, Duration responseTimeout) {
        return create(name, responseTimeout, Duration.ofSeconds(15));
    }

    /** {@code maxIdle}: how long an unused connection is kept for reuse; keep it below the server's own idle limit. */
    public static ReactorClientHttpConnector create(String name, Duration responseTimeout, Duration maxIdle) {
        ConnectionProvider provider = ConnectionProvider.builder(name)
            .maxConnections(50)
            .maxIdleTime(maxIdle)
            .maxLifeTime(Duration.ofMinutes(5))
            .evictInBackground(Duration.ofSeconds(30))
            .pendingAcquireTimeout(Duration.ofSeconds(10))
            .build();
        return new ReactorClientHttpConnector(HttpClient.create(provider).responseTimeout(responseTimeout));
    }
}
