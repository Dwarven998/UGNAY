package com.ugnay.ugnay.core.error;

import java.io.IOException;
import java.io.Writer;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import org.apache.catalina.connector.Request;
import org.apache.catalina.connector.Response;
import org.apache.catalina.valves.ErrorReportValve;
import org.apache.coyote.ActionCode;
import org.springframework.http.HttpStatus;

/**
 * Replaces Tomcat's HTML error page for requests Tomcat rejects before they reach Spring (malformed URL
 * encoding, oversized headers, ...). The default page names the server and its exact version ("Apache
 * Tomcat/10.1.x") and echoes parser details; this writes the standard {@link ApiErrorResponse} shape instead,
 * with only the generic message for the status. Errors that do reach Spring are unaffected: they are already
 * answered by GlobalExceptionHandler / ApiErrorController, and this valve skips any response with content.
 */
public class JsonErrorReportValve extends ErrorReportValve {

    @Override
    protected void report(Request request, Response response, Throwable throwable) {
        int status = response.getStatus();
        if (status < 400 || response.getContentWritten() > 0) {
            return;
        }
        AtomicBoolean ioAllowed = new AtomicBoolean(false);
        response.getCoyoteResponse().action(ActionCode.IS_IO_ALLOWED, ioAllowed);
        if (!ioAllowed.get()) {
            return;
        }
        try {
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            Writer writer = response.getReporter();
            if (writer != null) {
                writer.write(body(status));
                response.finishResponse();
            }
        } catch (IOException | IllegalStateException ignored) {
            // The client is gone or the response can no longer be written; nothing more to do.
        }
    }

    /**
     * The request never passed CorrelationIdFilter, so it gets a fresh id here. The path is omitted: the URL
     * may be the malformed part. Messages are fixed ASCII texts from {@link ErrorCode}, so no escaping is needed.
     */
    static String body(int status) {
        ErrorCode code = ErrorCode.forStatus(status);
        HttpStatus resolved = HttpStatus.resolve(status);
        return "{\"status\":\"error\",\"code\":\"" + code.name() + "\",\"message\":\"" + code.defaultMessage()
            + "\",\"error\":\"" + (resolved != null ? resolved.getReasonPhrase() : "Error")
            + "\",\"details\":[],\"timestamp\":\"" + Instant.now() + "\",\"path\":null,\"traceId\":\""
            + UUID.randomUUID() + "\"}";
    }
}
