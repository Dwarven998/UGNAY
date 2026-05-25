package com.ugnay.ugnay.post;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
public class PostSchedulerConfig {

    @Bean
    public ThreadPoolTaskScheduler postTaskScheduler() {
        ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();
        taskScheduler.setPoolSize(2);
        taskScheduler.setThreadNamePrefix("post-scheduler-");
        taskScheduler.initialize();
        return taskScheduler;
    }
}