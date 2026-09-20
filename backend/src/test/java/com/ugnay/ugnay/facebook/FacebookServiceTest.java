package com.ugnay.ugnay.facebook;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;

class FacebookServiceTest {

    private HttpServer server;
    private FacebookService facebookService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final List<String> recordedRequests = Collections.synchronizedList(new ArrayList<>());
    private final List<JsonNode> recordedBodies = Collections.synchronizedList(new ArrayList<>());

    @BeforeEach
    void setUp() throws IOException {
        recordedRequests.clear();
        recordedBodies.clear();

        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            byte[] rawBytes = exchange.getRequestBody().readAllBytes();
            String rawBody = new String(rawBytes, StandardCharsets.UTF_8);
            recordedRequests.add(path);

            if (!rawBody.isBlank()) {
                try {
                    recordedBodies.add(objectMapper.readTree(rawBody));
                } catch (Exception ignored) {
                }
            }

            String response;
            if (path.endsWith("/photos")) {
                // Return photo ID or post_id
                response = "{\"id\":\"photo_101\",\"post_id\":\"post_photo_101\"}";
            } else if (path.endsWith("/feed")) {
                // Return feed post ID
                response = "{\"id\":\"feed_post_202\"}";
            } else {
                response = "{}";
            }

            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        facebookService = new FacebookService();
        String serverUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        ReflectionTestUtils.setField(facebookService, "fbApiUrl", serverUrl);
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void publishPost_singleImage_postsToPhotosEndpoint() {
        String result = facebookService.publishPost(
            "access_token_123",
            "page_777",
            "Single image caption",
            "https://mycdn.com/test.jpg"
        );

        assertEquals("post_photo_101", result);
        assertEquals(1, recordedRequests.size());
        assertEquals("/page_777/photos", recordedRequests.get(0));
        assertEquals("Single image caption", recordedBodies.get(0).get("message").asText());
        assertEquals("https://mycdn.com/test.jpg", recordedBodies.get(0).get("url").asText());
    }

    @Test
    void publishPost_multiImage_uploadsUnpublishedPhotosThenPostsFeedWithAttachedMedia() {
        List<String> images = List.of(
            "https://mycdn.com/img1.jpg",
            "https://mycdn.com/img2.jpg",
            "https://mycdn.com/img3.jpg"
        );

        String result = facebookService.publishPost(
            "access_token_123",
            "page_777",
            "Multi image caption",
            images
        );

        assertEquals("feed_post_202", result);
        // 3 photo uploads + 1 feed post = 4 requests
        assertEquals(4, recordedRequests.size());
        assertEquals("/page_777/photos", recordedRequests.get(0));
        assertEquals("/page_777/photos", recordedRequests.get(1));
        assertEquals("/page_777/photos", recordedRequests.get(2));
        assertEquals("/page_777/feed", recordedRequests.get(3));

        // Check that photo uploads were unpublished
        assertNotNull(recordedBodies.get(0).get("published"));
        assertEquals(false, recordedBodies.get(0).get("published").asBoolean());

        // Check that feed post has message and attached_media with 3 items
        JsonNode feedBody = recordedBodies.get(3);
        assertEquals("Multi image caption", feedBody.get("message").asText());
        JsonNode attachedMedia = feedBody.get("attached_media");
        assertNotNull(attachedMedia);
        assertEquals(3, attachedMedia.size());
        assertEquals("photo_101", attachedMedia.get(0).get("media_fbid").asText());
    }

    @Test
    void publishPost_textOnly_postsToFeedEndpoint() {
        String result = facebookService.publishPost(
            "access_token_123",
            "page_777",
            "Text only caption",
            List.of()
        );

        assertEquals("feed_post_202", result);
        assertEquals(1, recordedRequests.size());
        assertEquals("/page_777/feed", recordedRequests.get(0));
        assertEquals("Text only caption", recordedBodies.get(0).get("message").asText());
    }

    @Test
    void publishPost_singleImage_sanitizesUrlWithSpaces() {
        String urlWithSpaces = "https://mycdn.com/media/1779950724895_let me know ahh dog.jpg";
        String result = facebookService.publishPost(
            "access_token_123",
            "page_777",
            "Space URL caption",
            urlWithSpaces
        );

        assertEquals("post_photo_101", result);
        // The URL sent to Facebook should have spaces encoded as %20
        String sentUrl = recordedBodies.get(0).get("url").asText();
        assertEquals(
            "https://mycdn.com/media/1779950724895_let%20me%20know%20ahh%20dog.jpg",
            sentUrl,
            "Spaces in image URL must be percent-encoded for Facebook Graph API"
        );
    }

    @Test
    void publishPost_multiImage_sanitizesUrlsWithSpaces() {
        List<String> images = List.of(
            "https://mycdn.com/img1.jpg",
            "https://mycdn.com/media/let me know ahh dog.jpg"
        );

        String result = facebookService.publishPost(
            "access_token_123",
            "page_777",
            "Multi with spaces",
            images
        );

        assertEquals("feed_post_202", result);
        // 2 photo uploads + 1 feed = 3 requests
        assertEquals(3, recordedRequests.size());
        // Second photo upload should have encoded URL
        String sentUrl = recordedBodies.get(1).get("url").asText();
        assertEquals(
            "https://mycdn.com/media/let%20me%20know%20ahh%20dog.jpg",
            sentUrl,
            "Spaces in multi-image URL must be percent-encoded"
        );
    }
}
