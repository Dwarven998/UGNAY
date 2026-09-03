package com.ugnay.ugnay;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class UgnayApplication {

	public static void main(String[] args) {
		SpringApplication.run(UgnayApplication.class, args);
	}

}
