package com.terrapulse.api;

import com.terrapulse.domain.client.Client;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.domain.mechanic.MechanicStatus;
import com.terrapulse.domain.site.Site;
import com.terrapulse.domain.vehicle.Vehicle;
import com.terrapulse.domain.vehicle.VehicleClass;
import com.terrapulse.domain.vehicle.VehicleStatus;
import com.terrapulse.domain.vmrs.VmrsCode;
import com.terrapulse.repository.ClientRepository;
import com.terrapulse.repository.MechanicRepository;
import com.terrapulse.repository.ServiceOrderRepository;
import com.terrapulse.repository.SiteRepository;
import com.terrapulse.repository.VehicleRepository;
import com.terrapulse.repository.VmrsCodeRepository;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
@TestSecurity(authorizationEnabled = false)
class ServiceOrderCreateTest {

    @Inject ServiceOrderRepository repo;
    @Inject VehicleRepository vehicleRepo;
    @Inject MechanicRepository mechanicRepo;
    @Inject ClientRepository clientRepo;
    @Inject SiteRepository siteRepo;
    @Inject VmrsCodeRepository vmrsRepo;

    private final List<UUID> createdOrders = new ArrayList<>();
    private final List<UUID> createdMechanics = new ArrayList<>();
    private final List<UUID> createdVehicles = new ArrayList<>();
    private final List<UUID> createdSites = new ArrayList<>();
    private final List<UUID> createdClients = new ArrayList<>();
    private final List<String> createdVmrsCodes = new ArrayList<>();

    @AfterEach
    void cleanup() {
        Panache.withTransaction(() -> {
            Uni<Void> chain = Uni.createFrom().voidItem();
            for (UUID id : createdOrders)     chain = chain.flatMap(v -> repo.deleteById(id).replaceWithVoid());
            for (UUID id : createdMechanics)  chain = chain.flatMap(v -> mechanicRepo.deleteById(id).replaceWithVoid());
            for (UUID id : createdVehicles)   chain = chain.flatMap(v -> vehicleRepo.deleteById(id).replaceWithVoid());
            for (UUID id : createdSites)      chain = chain.flatMap(v -> siteRepo.deleteById(id).replaceWithVoid());
            for (UUID id : createdClients)    chain = chain.flatMap(v -> clientRepo.deleteById(id).replaceWithVoid());
            for (String c : createdVmrsCodes) chain = chain.flatMap(v -> vmrsRepo.deleteById(c).replaceWithVoid());
            return chain;
        }).await().indefinitely();
        createdOrders.clear();
        createdMechanics.clear();
        createdVehicles.clear();
        createdSites.clear();
        createdClients.clear();
        createdVmrsCodes.clear();
    }

    Client seedClient() {
        Client c = new Client();
        c.name = "Test Client " + UUID.randomUUID();
        c.email = "test+" + UUID.randomUUID() + "@example.com";
        Client result = Panache.withTransaction(() -> clientRepo.persist(c).replaceWith(c))
            .await().indefinitely();
        createdClients.add(result.id);
        return result;
    }

    Site seedSite(UUID clientId) {
        Site s = new Site();
        s.name = "Test Site " + UUID.randomUUID();
        s.lat = 51.5074;
        s.lng = -0.1278;
        Site result = Panache.withTransaction(() ->
            clientRepo.findById(clientId).flatMap(client -> {
                s.client = client;
                return siteRepo.persist(s).replaceWith(s);
            })
        ).await().indefinitely();
        createdSites.add(result.id);
        return result;
    }

    Vehicle seedVehicle(UUID siteId) {
        Vehicle v = new Vehicle();
        v.make = "CAT";
        v.model = "336";
        v.serialNumber = "SN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        v.vehicleClass = VehicleClass.EXCAVATOR;
        v.status = VehicleStatus.AVAILABLE;
        Vehicle result = Panache.withTransaction(() ->
            siteRepo.findById(siteId).flatMap(site -> {
                v.site = site;
                return vehicleRepo.persist(v).replaceWith(v);
            })
        ).await().indefinitely();
        createdVehicles.add(result.id);
        return result;
    }

    VmrsCode seedVmrs() {
        VmrsCode vc = new VmrsCode();
        vc.code = UUID.randomUUID().toString().replace("-", "").substring(0, 9);
        vc.description = "Test service";
        vc.srtMinutes = 60;
        vc.difficultyFactor = BigDecimal.ONE;
        VmrsCode result = Panache.withTransaction(() -> vmrsRepo.persist(vc).replaceWith(vc))
            .await().indefinitely();
        createdVmrsCodes.add(result.code);
        return result;
    }

    Mechanic seedMechanic() {
        Mechanic m = new Mechanic();
        m.fullName = "Test Mech " + UUID.randomUUID();
        m.status = MechanicStatus.IDLE;
        Mechanic result = Panache.withTransaction(() -> mechanicRepo.persist(m).replaceWith(m))
            .await().indefinitely();
        createdMechanics.add(result.id);
        return result;
    }

    // ---------------------------------------------------------------------------
    // Test 1: create without schedule → REQUESTED, estimatedMinutes from estimation string
    // ---------------------------------------------------------------------------

    @Test
    void create_withoutSchedule_returnsRequested() {
        Client client = seedClient();
        Site site = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vmrsCode = seedVmrs();

        String body = String.format("""
                {
                  "vehicleId": "%s",
                  "siteId": "%s",
                  "vmrsCode": "%s",
                  "estimation": "2h"
                }
                """, vehicle.id, site.id, vmrsCode.code);

        UUID createdId = given()
                .contentType(ContentType.JSON)
                .body(body)
            .when()
                .post("/api/service-orders")
            .then()
                .statusCode(201)
                .body("state", equalTo("REQUESTED"))
                .body("estimatedMinutes", equalTo(120))
                .body("scheduledStartAt", nullValue())
                .body("mechanicId", nullValue())
                .extract().jsonPath().getUUID("id");

        createdOrders.add(createdId);
    }

    // ---------------------------------------------------------------------------
    // Test 2: create with full schedule → SCHEDULED, mechanic and timestamps set
    // ---------------------------------------------------------------------------

    @Test
    void create_withFullSchedule_returnsScheduled() {
        Client client = seedClient();
        Site site = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vmrsCode = seedVmrs();
        Mechanic mechanic = seedMechanic();

        String scheduledStart = "2026-06-01T08:00:00Z";
        String scheduledEnd   = "2026-06-01T09:00:00Z";

        String body = String.format("""
                {
                  "vehicleId": "%s",
                  "siteId": "%s",
                  "vmrsCode": "%s",
                  "estimation": "1h",
                  "mechanicId": "%s",
                  "scheduledStartAt": "%s",
                  "scheduledEndAt": "%s"
                }
                """, vehicle.id, site.id, vmrsCode.code, mechanic.id, scheduledStart, scheduledEnd);

        UUID createdId = given()
                .contentType(ContentType.JSON)
                .body(body)
            .when()
                .post("/api/service-orders")
            .then()
                .statusCode(201)
                .body("state", equalTo("SCHEDULED"))
                .body("mechanicId", notNullValue())
                .body("scheduledStartAt", notNullValue())
                .extract().jsonPath().getUUID("id");

        createdOrders.add(createdId);
    }

    // ---------------------------------------------------------------------------
    // Test 3: create with invalid estimation string → 400
    // ---------------------------------------------------------------------------

    @Test
    void create_invalidEstimation_returns400() {
        Client client = seedClient();
        Site site = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vmrsCode = seedVmrs();

        String body = String.format("""
                {
                  "vehicleId": "%s",
                  "siteId": "%s",
                  "vmrsCode": "%s",
                  "estimation": "garbage"
                }
                """, vehicle.id, site.id, vmrsCode.code);

        given()
                .contentType(ContentType.JSON)
                .body(body)
            .when()
                .post("/api/service-orders")
            .then()
                .statusCode(400);
    }
}
