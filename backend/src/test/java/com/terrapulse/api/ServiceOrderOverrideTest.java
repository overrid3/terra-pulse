package com.terrapulse.api;

import com.terrapulse.domain.client.Client;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.domain.mechanic.MechanicStatus;
import com.terrapulse.domain.service.ServiceOrder;
import com.terrapulse.domain.service.ServiceOrderState;
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
import com.terrapulse.service.GeometrySupport;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

/**
 * Integration tests for POST /api/service-orders/{id}/override-state.
 *
 * Seeding strategy: each test method seeds via REQUIRES_NEW transactions that
 * commit immediately, making the data visible to the HTTP layer. AfterEach
 * deletes the created rows (also committed) to isolate tests without relying on
 * rollback, which cannot span across the HTTP request boundary.
 */
@QuarkusTest
class ServiceOrderOverrideTest {

    @Inject ServiceOrderRepository repo;
    @Inject VehicleRepository vehicleRepo;
    @Inject MechanicRepository mechanicRepo;
    @Inject ClientRepository clientRepo;
    @Inject SiteRepository siteRepo;
    @Inject VmrsCodeRepository vmrsRepo;
    @Inject GeometrySupport geo;

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
    VmrsCode seedVmrsCode() {
        VmrsCode vc = new VmrsCode();
        // 9-char max; use first 9 chars of a UUID (no dashes in that segment)
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

    @Transactional(jakarta.transaction.Transactional.TxType.REQUIRES_NEW)
    UUID seedOrder(ServiceOrderState state, UUID vehicleId, String vmrsCode,
                   UUID clientId, UUID siteId, UUID mechanicId,
                   Instant dispatchedAt, Instant startedAt, Instant completedAt,
                   Integer actualMinutes) {
        Vehicle vehicle = vehicleRepo.findById(vehicleId);
        VmrsCode vc = vmrsRepo.findById(vmrsCode);
        Client client = clientRepo.findById(clientId);
        Site site = siteRepo.findById(siteId);
        Mechanic mechanic = mechanicId != null ? mechanicRepo.findById(mechanicId) : null;

        ServiceOrder so = new ServiceOrder();
        so.vehicle = vehicle;
        so.vmrsCode = vc;
        so.client = client;
        so.site = site;
        so.title = "Test Order";
        so.state = state;
        so.estimatedMinutes = 60;
        so.siteLocation = geo.point(site.lng, site.lat);
        so.mechanic = mechanic;
        so.dispatchedAt = dispatchedAt;
        so.startedAt = startedAt;
        so.completedAt = completedAt;
        so.actualMinutes = actualMinutes;
        repo.persist(so);
        createdOrders.add(so.id);
        return so.id;
    }

    // ---------------------------------------------------------------------------
    // Test 1: override to REQUESTED clears lifecycle fields
    // ---------------------------------------------------------------------------

    @Test
    void overrideToRequestedClearsLifecycleFields() {
        Client client = seedClient();
        Site site = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vmrsCode = seedVmrsCode();
        Mechanic mechanic = seedMechanic();

        UUID orderId = seedOrder(
                ServiceOrderState.COMPLETED, vehicle.id, vmrsCode.code,
                client.id, site.id, mechanic.id,
                Instant.now(), Instant.now(), Instant.now(), 90
        );

        given()
            .contentType(ContentType.JSON)
            .body("{\"state\":\"REQUESTED\",\"reason\":\"reopen\"}")
        .when()
            .post("/api/service-orders/{id}/override-state", orderId)
        .then()
            .statusCode(200)
            .body("state", equalTo("REQUESTED"))
            .body("mechanicId", nullValue())
            .body("dispatchedAt", nullValue())
            .body("startedAt", nullValue())
            .body("completedAt", nullValue())
            .body("actualMinutes", nullValue());
    }

    // ---------------------------------------------------------------------------
    // Test 2: override to DISPATCHED without mechanic returns 400
    // ---------------------------------------------------------------------------

    @Test
    void overrideToDispatchedRequiresMechanic() {
        Client client = seedClient();
        Site site = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vmrsCode = seedVmrsCode();

        UUID orderId = seedOrder(
                ServiceOrderState.APPROVED, vehicle.id, vmrsCode.code,
                client.id, site.id, null, null, null, null, null
        );

        given()
            .contentType(ContentType.JSON)
            .body("{\"state\":\"DISPATCHED\",\"reason\":\"force\"}")
        .when()
            .post("/api/service-orders/{id}/override-state", orderId)
        .then()
            .statusCode(400);
    }

    // ---------------------------------------------------------------------------
    // Test 3: override to DISPATCHED with mechanic sets timestamp
    // ---------------------------------------------------------------------------

    @Test
    void overrideToDispatchedWithMechanicSetsTimestamp() {
        Client client = seedClient();
        Site site = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vmrsCode = seedVmrsCode();
        Mechanic mechanic = seedMechanic();

        UUID orderId = seedOrder(
                ServiceOrderState.APPROVED, vehicle.id, vmrsCode.code,
                client.id, site.id, null, null, null, null, null
        );

        given()
            .contentType(ContentType.JSON)
            .body("{\"state\":\"DISPATCHED\",\"reason\":\"force\",\"mechanicId\":\"" + mechanic.id + "\"}")
        .when()
            .post("/api/service-orders/{id}/override-state", orderId)
        .then()
            .statusCode(200)
            .body("state", equalTo("DISPATCHED"))
            .body("mechanicId", equalTo(mechanic.id.toString()))
            .body("dispatchedAt", notNullValue());
    }

    // ---------------------------------------------------------------------------
    // Test 4: override to COMPLETED without actualMinutes returns 400
    // ---------------------------------------------------------------------------

    @Test
    void overrideToCompletedRequiresActualMinutes() {
        Client client = seedClient();
        Site site = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vmrsCode = seedVmrsCode();
        Mechanic mechanic = seedMechanic();

        UUID orderId = seedOrder(
                ServiceOrderState.APPROVED, vehicle.id, vmrsCode.code,
                client.id, site.id, null, null, null, null, null
        );

        given()
            .contentType(ContentType.JSON)
            .body("{\"state\":\"COMPLETED\",\"reason\":\"force\",\"mechanicId\":\"" + mechanic.id + "\"}")
        .when()
            .post("/api/service-orders/{id}/override-state", orderId)
        .then()
            .statusCode(400);
    }

    // ---------------------------------------------------------------------------
    // Test 5: override to COMPLETED with all fields succeeds
    // ---------------------------------------------------------------------------

    @Test
    void overrideToCompletedFullPath() {
        Client client = seedClient();
        Site site = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vmrsCode = seedVmrsCode();
        Mechanic mechanic = seedMechanic();

        UUID orderId = seedOrder(
                ServiceOrderState.APPROVED, vehicle.id, vmrsCode.code,
                client.id, site.id, null, null, null, null, null
        );

        given()
            .contentType(ContentType.JSON)
            .body("{\"state\":\"COMPLETED\",\"reason\":\"force\",\"mechanicId\":\"" + mechanic.id
                    + "\",\"actualMinutes\":45}")
        .when()
            .post("/api/service-orders/{id}/override-state", orderId)
        .then()
            .statusCode(200)
            .body("state", equalTo("COMPLETED"))
            .body("actualMinutes", equalTo(45))
            .body("completedAt", notNullValue());
    }

    // ---------------------------------------------------------------------------
    // Test 6: override appends audit note containing "override" and the reason
    // ---------------------------------------------------------------------------

    @Test
    void overrideAppendsNotesAudit() {
        Client client = seedClient();
        Site site = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vmrsCode = seedVmrsCode();

        UUID orderId = seedOrder(
                ServiceOrderState.REQUESTED, vehicle.id, vmrsCode.code,
                client.id, site.id, null, null, null, null, null
        );

        given()
            .contentType(ContentType.JSON)
            .body("{\"state\":\"CANCELLED\",\"reason\":\"wrong vehicle\"}")
        .when()
            .post("/api/service-orders/{id}/override-state", orderId)
        .then()
            .statusCode(200)
            .body("notes", containsString("override"))
            .body("notes", containsString("wrong vehicle"));
    }
}
