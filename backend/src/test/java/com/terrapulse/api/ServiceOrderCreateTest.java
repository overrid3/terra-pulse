package com.terrapulse.api;

import com.terrapulse.domain.client.Client;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.domain.mechanic.MechanicStatus;
import com.terrapulse.domain.service.ServiceOrder;
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
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
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

/**
 * Integration tests for POST /api/service-orders.
 *
 * Seeding strategy: each test method seeds via REQUIRES_NEW transactions that
 * commit immediately, making the data visible to the HTTP layer. AfterEach
 * deletes the created rows (also committed) to isolate tests without relying on
 * rollback, which cannot span across the HTTP request boundary.
 */
@QuarkusTest
class ServiceOrderCreateTest {

    @Inject ServiceOrderRepository repo;
    @Inject VehicleRepository vehicleRepo;
    @Inject MechanicRepository mechanicRepo;
    @Inject ClientRepository clientRepo;
    @Inject SiteRepository siteRepo;
    @Inject VmrsCodeRepository vmrsRepo;

    // Track created IDs for cleanup
    private final List<UUID> createdOrders = new ArrayList<>();
    private final List<UUID> createdMechanics = new ArrayList<>();
    private final List<UUID> createdVehicles = new ArrayList<>();
    private final List<UUID> createdSites = new ArrayList<>();
    private final List<UUID> createdClients = new ArrayList<>();
    private final List<String> createdVmrsCodes = new ArrayList<>();

    // ---------------------------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------------------------

    @AfterEach
    @Transactional
    void cleanup() {
        createdOrders.forEach(id -> repo.deleteById(id));
        createdMechanics.forEach(id -> mechanicRepo.deleteById(id));
        createdVehicles.forEach(id -> vehicleRepo.deleteById(id));
        createdSites.forEach(id -> siteRepo.deleteById(id));
        createdClients.forEach(id -> clientRepo.deleteById(id));
        createdVmrsCodes.forEach(code -> vmrsRepo.deleteById(code));
        createdOrders.clear();
        createdMechanics.clear();
        createdVehicles.clear();
        createdSites.clear();
        createdClients.clear();
        createdVmrsCodes.clear();
    }

    // ---------------------------------------------------------------------------
    // Seed helpers — each commits immediately (REQUIRES_NEW)
    // ---------------------------------------------------------------------------

    @Transactional(jakarta.transaction.Transactional.TxType.REQUIRES_NEW)
    Client seedClient() {
        Client c = new Client();
        c.name = "Test Client " + UUID.randomUUID();
        c.email = "test+" + UUID.randomUUID() + "@example.com";
        clientRepo.persist(c);
        createdClients.add(c.id);
        return c;
    }

    @Transactional(jakarta.transaction.Transactional.TxType.REQUIRES_NEW)
    Site seedSite(UUID clientId) {
        Client client = clientRepo.findById(clientId);
        Site s = new Site();
        s.client = client;
        s.name = "Test Site " + UUID.randomUUID();
        s.lat = 51.5074;
        s.lng = -0.1278;
        siteRepo.persist(s);
        createdSites.add(s.id);
        return s;
    }

    @Transactional(jakarta.transaction.Transactional.TxType.REQUIRES_NEW)
    Vehicle seedVehicle(UUID siteId) {
        Site site = siteRepo.findById(siteId);
        Vehicle v = new Vehicle();
        v.make = "CAT";
        v.model = "336";
        v.serialNumber = "SN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        v.vehicleClass = VehicleClass.EXCAVATOR;
        v.status = VehicleStatus.AVAILABLE;
        v.site = site;
        vehicleRepo.persist(v);
        createdVehicles.add(v.id);
        return v;
    }

    @Transactional(jakarta.transaction.Transactional.TxType.REQUIRES_NEW)
    VmrsCode seedVmrs() {
        VmrsCode vc = new VmrsCode();
        vc.code = UUID.randomUUID().toString().replace("-", "").substring(0, 9);
        vc.description = "Test service";
        vc.srtMinutes = 60;
        vc.difficultyFactor = BigDecimal.ONE;
        vmrsRepo.persist(vc);
        createdVmrsCodes.add(vc.code);
        return vc;
    }

    @Transactional(jakarta.transaction.Transactional.TxType.REQUIRES_NEW)
    Mechanic seedMechanic() {
        Mechanic m = new Mechanic();
        m.fullName = "Test Mech " + UUID.randomUUID();
        m.status = MechanicStatus.IDLE;
        mechanicRepo.persist(m);
        createdMechanics.add(m.id);
        return m;
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
