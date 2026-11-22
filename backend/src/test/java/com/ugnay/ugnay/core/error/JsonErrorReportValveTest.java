package com.ugnay.ugnay.core.error;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServer;

/**
 * A real embedded Tomcat with the UGNAY customizer: requests rejected by Tomcat itself, before any servlet or
 * filter runs, must get the JSON error shape and must not reveal the server software or version.
 */
class JsonErrorReportValveTest {

    private WebServer server;

    @BeforeEach
    void start() {
        TomcatServletWebServerFactory factory = new TomcatServletWebServerFactory(0);
        new TomcatErrorPageConfig().jsonErrorReportValve().customize(factory);
        server = factory.getWebServer();
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop();
    }

    @Test
    void malformedUrlEncodingGetsJsonWithoutServerDetails() throws Exception {
        String response = send("GET /api/auth/%zz HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n");

        assertTrue(response.startsWith("HTTP/1.1 400"), response);
        assertTrue(response.contains("application/json"), response);
        assertTrue(response.contains("\"code\":\"BAD_REQUEST\""), response);
        assertTrue(response.contains("\"traceId\":\""), response);
        assertFalse(response.contains("Tomcat"), "server software leaked: " + response);
        assertFalse(response.contains("<html"), response);
        assertFalse(response.contains("hexadecimal"), "parser detail leaked: " + response);
    }

    @Test
    void oversizedHeaderGetsJsonWithoutServerDetails() throws Exception {
        String big = "a".repeat(20_000);
        String response = send("GET /api/health HTTP/1.1\r\nHost: localhost\r\nX-Big: " + big + "\r\nConnection: close\r\n\r\n");

        assertTrue(response.startsWith("HTTP/1.1 400"), response.substring(0, Math.min(200, response.length())));
        assertFalse(response.contains("Tomcat"));
        assertFalse(response.contains("<html"));
    }

    private String send(String rawRequest) throws Exception {
        try (Socket socket = new Socket("localhost", server.getPort())) {
            socket.setSoTimeout(10_000);
            OutputStream out = socket.getOutputStream();
            out.write(rawRequest.getBytes(StandardCharsets.ISO_8859_1));
            out.flush();
            InputStream in = socket.getInputStream();
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            in.transferTo(buffer);
            return buffer.toString(StandardCharsets.UTF_8);
        }
    }
}
