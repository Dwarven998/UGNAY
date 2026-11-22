package com.ugnay.ugnay.core.error;

import org.apache.catalina.core.StandardHost;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Makes the embedded Tomcat use {@link JsonErrorReportValve} instead of its default HTML error page. */
@Configuration
public class TomcatErrorPageConfig {

    @Bean
    WebServerFactoryCustomizer<TomcatServletWebServerFactory> jsonErrorReportValve() {
        return factory -> factory.addContextCustomizers(context -> {
            if (context.getParent() instanceof StandardHost host) {
                host.setErrorReportValveClass(JsonErrorReportValve.class.getName());
            }
        });
    }
}
