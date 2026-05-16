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
import static org.hamcrest.Matchers.equalTo;

/**
 * Integration tests for PATCH /api/service-orders/{id}/schedule.
 *
 * Seeding strategy mirrors ServiceOrderOverrideTest: REQUIRES_NEW transactions
 * commit immediately so data is visible to the HTTP layer. AfterEach deletes
 * created rows to isolate tests.
 */
@QuarkusTest
class ServiceOrderRescheduleTest {

    @Inject ServiceOrderRepository repo;
    @Inject VehicleRepository vehicleRepo;
    @Inject MechanicRepository mechanicRepo;
    @Inject ClientRepository clientRepo;
    @Inject SiteRepository siteRepo;
    @Inject VmrsCodeRepository vmrsRepo;
    @Inject GeometrySupport geo;

    private final List<UUID> createdOrders    = new ArrayList<>();
    private final List<UUID> createdMechanics = new ArrayList<>();
    private final List<UUID> createdVehicles  = new ArrayList<>();
    private final List<UUID> createdSites     = new ArrayList<>();
    private final List<UUID> createdClients   = new ArrayList<>();
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
        v.model = "320";
        v.serialNumber = "SN-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
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

    /**
     * Persists a ServiceOrder directly in SCHEDULED state with the given
     * scheduledStartAt / scheduledEndAt ISO strings. A mechanic is required by
     * the domain model for SCHEDULED orders.
     */
    @Transactional(jakarta.transaction.Transactional.TxType.REQUIRES_NEW)
    UUID seedScheduledOrder(UUID vehicleId, String vmrsCode, UUID clientId,
                            UUID siteId, UUID mechanicId,
                            String startISO, String endISO) {
        Vehicle vehicle   = vehicleRepo.findById(vehicleId);
        VmrsCode vc       = vmrsRepo.findById(vmrsCode);
        Client client     = clientRepo.findById(clientId);
        Site site         = siteRepo.findById(siteId);
        Mechanic mechanic = mechanicRepo.findById(mechanicId);

        ServiceOrder so = new ServiceOrder();
        so.vehicle           = vehicle;
        so.vmrsCode          = vc;
        so.client            = client;
        so.site              = site;
        so.title             = "Reschedule Test Order";
        so.state             = ServiceOrderState.SCHEDULED;
        so.estimatedMinutes  = 60;
        so.siteLocation      = geo.point(site.lng, site.lat);
        so.mechanic          = mechanic;
        so.scheduledStartAt  = Instant.parse(startISO);
        so.scheduledEndAt    = Instant.parse(endISO);
        repo.persist(so);
        createdOrders.add(so.id);
        return so.id;
    }

    /**
     * Persists a ServiceOrder directly in the given non-SCHEDULED state
     * (no schedule times needed).
     */
    @Transactional(jakarta.transaction.Transactional.TxType.REQUIRES_NEW)
    UUID seedOrderInState(ServiceOrderState state, UUID vehicleId, String vmrsCode,
                          UUID clientId, UUID siteId) {
        Vehicle vehicle = vehicleRepo.findById(vehicleId);
        VmrsCode vc     = vmrsRepo.findById(vmrsCode);
        Client client   = clientRepo.findById(clientId);
        Site site       = siteRepo.findById(siteId);

        ServiceOrder so = new ServiceOrder();
        so.vehicle          = vehicle;
        so.vmrsCode         = vc;
        so.client           = client;
        so.site             = site;
        so.title            = "State Test Order";
        so.state            = state;
        so.estimatedMinutes = 60;
        so.siteLocation     = geo.point(site.lng, site.lat);
        repo.persist(so);
        createdOrders.add(so.id);
        return so.id;
    }

    // ---------------------------------------------------------------------------
    // Test 1: PATCH time window only — updates scheduledStartAt and scheduledEndAt
    // ---------------------------------------------------------------------------

    @Test
    void patch_timeOnly_updatesWindow() {
        Client client   = seedClient();
        Site site       = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vc     = seedVmrsCode();
        Mechanic mech   = seedMechanic();

        UUID orderId = seedScheduledOrder(vehicle.id, vc.code, client.id, site.id, mech.id,
                "2026-06-01T08:00:00Z", "2026-06-01T09:00:00Z");

        given()
            .contentType(ContentType.JSON)
            .body("{\"scheduledStartAt\":\"2026-06-01T10:00:00Z\","
                    + "\"scheduledEndAt\":\"2026-06-01T11:00:00Z\"}")
        .when()
            .patch("/api/service-orders/{id}/schedule", orderId)
        .then()
            .statusCode(200)
            .body("scheduledStartAt", equalTo("2026-06-01T10:00:00Z"))
            .body("scheduledEndAt",   equalTo("2026-06-01T11:00:00Z"));
    }

    // ---------------------------------------------------------------------------
    // Test 2: PATCH mechanic only — reassigns the mechanic
    // ---------------------------------------------------------------------------

    @Test
    void patch_mechanicOnly_reassigns() {
        Client client    = seedClient();
        Site site        = seedSite(client.id);
        Vehicle vehicle  = seedVehicle(site.id);
        VmrsCode vc      = seedVmrsCode();
        Mechanic mech1   = seedMechanic();
        Mechanic mech2   = seedMechanic();

        UUID orderId = seedScheduledOrder(vehicle.id, vc.code, client.id, site.id, mech1.id,
                "2026-06-01T08:00:00Z", "2026-06-01T09:00:00Z");

        given()
            .contentType(ContentType.JSON)
            .body("{\"mechanicId\":\"" + mech2.id + "\"}")
        .when()
            .patch("/api/service-orders/{id}/schedule", orderId)
        .then()
            .statusCode(200)
            .body("mechanicId", equalTo(mech2.id.toString()));
    }

    // ---------------------------------------------------------------------------
    // Test 3: PATCH with start > end returns 400
    // ---------------------------------------------------------------------------

    @Test
    void patch_invalidWindow_returns400() {
        Client client   = seedClient();
        Site site       = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vc     = seedVmrsCode();
        Mechanic mech   = seedMechanic();

        UUID orderId = seedScheduledOrder(vehicle.id, vc.code, client.id, site.id, mech.id,
                "2026-06-01T08:00:00Z", "2026-06-01T09:00:00Z");

        given()
            .contentType(ContentType.JSON)
            // end is before start — invalid window
            .body("{\"scheduledStartAt\":\"2026-06-01T11:00:00Z\","
                    + "\"scheduledEndAt\":\"2026-06-01T10:00:00Z\"}")
        .when()
            .patch("/api/service-orders/{id}/schedule", orderId)
        .then()
            .statusCode(400);
    }

    // ---------------------------------------------------------------------------
    // Test 4: PATCH on a non-SCHEDULED order returns 409
    // ---------------------------------------------------------------------------

    @Test
    void patch_notScheduledState_returns409() {
        Client client   = seedClient();
        Site site       = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vc     = seedVmrsCode();

        UUID orderId = seedOrderInState(ServiceOrderState.REQUESTED, vehicle.id, vc.code,
                client.id, site.id);

        given()
            .contentType(ContentType.JSON)
            .body("{\"scheduledStartAt\":\"2026-06-01T10:00:00Z\","
                    + "\"scheduledEndAt\":\"2026-06-01T11:00:00Z\"}")
        .when()
            .patch("/api/service-orders/{id}/schedule", orderId)
        .then()
            .statusCode(409);
    }
}
