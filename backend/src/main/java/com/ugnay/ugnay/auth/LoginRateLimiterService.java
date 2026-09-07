package com.ugnay.ugnay.auth;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LoginRateLimiterService {

    private final Map<String, Bucket> ipBuckets = new ConcurrentHashMap<>();
    private final Map<String, Integer> failedAttempts = new ConcurrentHashMap<>();
    private final Map<String, Long> lockouts = new ConcurrentHashMap<>();

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

    // --- 1. IP-based Rate Limiting (Token Bucket) ---
    private Bucket createNewIpBucket() {
        // Permits up to 5 login attempts per minute per IP address
        Bandwidth limit = Bandwidth.classic(5, Refill.greedy(5, Duration.ofMinutes(1)));
        return Bucket.builder().addLimit(limit).build();
    }

    public boolean tryConsumeIp(String ipAddress) {
        Bucket bucket = ipBuckets.computeIfAbsent(ipAddress, k -> createNewIpBucket());
        return bucket.tryConsume(1);
    }

    // --- 2. Account Lockout Protection ---
    public boolean isAccountLocked(String email) {
        if (email == null) return false;
        String key = email.toLowerCase().trim();

        if (lockouts.containsKey(key)) {
            long lockoutTime = lockouts.get(key);
            if (System.currentTimeMillis() - lockoutTime < LOCKOUT_DURATION_MS) {
                return true; // Lockout active
            } else {
                // Lockout period expired
                lockouts.remove(key);
                failedAttempts.remove(key);
            }
        }
        return false;
    }

    public void recordFailedLogin(String email) {
        if (email == null) return;
        String key = email.toLowerCase().trim();

        int attempts = failedAttempts.getOrDefault(key, 0) + 1;
        failedAttempts.put(key, attempts);

        if (attempts >= MAX_FAILED_ATTEMPTS) {
            lockouts.put(key, System.currentTimeMillis());
        }
    }

    public void recordSuccessfulLogin(String email) {
        if (email == null) return;
        String key = email.toLowerCase().trim();

        failedAttempts.remove(key);
        lockouts.remove(key);
    }

    public int getRemainingAttempts(String email) {
        if (email == null) return MAX_FAILED_ATTEMPTS;
        String key = email.toLowerCase().trim();

        int attempts = failedAttempts.getOrDefault(key, 0);
        return Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
    }
}