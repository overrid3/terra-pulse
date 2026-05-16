package com.terrapulse.api;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
class EstimationResourceTest {

    @Test
    void parse_validInput_returnsMinutes() {
        given()
            .contentType("application/json")
            .body("{\"input\":\"1d 2h\"}")
        .when()
            .post("/api/estimation/parse")
        .then()
            .statusCode(200)
            .body("minutes", equalTo(600));
    }

    @Test
    void parse_invalidInput_returns400() {
        given()
            .contentType("application/json")
            .body("{\"input\":\"abc\"}")
        .when()
            .post("/api/estimation/parse")
        .then()
            .statusCode(400)
            .body("error", equalTo("invalid_estimation"));
    }
}
