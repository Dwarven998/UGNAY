package com.ugnay.ugnay.core;

import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public liveness check for the keep-alive pinger (cron-job.org), which stops the hosted backend from
 * sleeping. It reads nothing (no database, no session, no configuration) and returns no data beyond
 * "ok", so it is safe to expose and cheap to call.
 */
@RestController
public class HealthController {

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(Map.of("status", "ok"));
    }
}
