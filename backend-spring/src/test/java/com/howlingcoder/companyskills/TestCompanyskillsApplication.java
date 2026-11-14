package com.howlingcoder.companyskills;

import org.springframework.boot.SpringApplication;

public class TestCompanyskillsApplication {

	public static void main(String[] args) {
		SpringApplication.from(CompanyskillsApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
