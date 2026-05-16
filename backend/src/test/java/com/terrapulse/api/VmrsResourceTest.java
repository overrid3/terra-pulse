package com.terrapulse.api;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class VmrsResourceTest {

    @Test
    void list_returnsSeededRows() {
        given()
            .when().get("/api/vmrs-codes")
            .then().statusCode(200)
                   .body("size()", greaterThan(0))
                   .body("[0].code", notNullValue())
                   .body("[0].srtMinutes", greaterThan(0));
    }
}
