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

@QuarkusTest
@TestSecurity(authorizationEnabled = false)
class ServiceOrderScheduleTest extends ReactiveTestBase {

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

    @AfterEach
    void cleanup() {
        runBlocking(() -> Panache.withTransaction(() -> {
            Uni<Void> chain = Uni.createFrom().voidItem();
            for (UUID id : createdOrders)     chain = chain.flatMap(v -> repo.deleteById(id).replaceWithVoid());
            for (UUID id : createdMechanics)  chain = chain.flatMap(v -> mechanicRepo.deleteById(id).replaceWithVoid());
            for (UUID id : createdVehicles)   chain = chain.flatMap(v -> vehicleRepo.deleteById(id).replaceWithVoid());
            for (UUID id : createdSites)      chain = chain.flatMap(v -> siteRepo.deleteById(id).replaceWithVoid());
            for (UUID id : createdClients)    chain = chain.flatMap(v -> clientRepo.deleteById(id).replaceWithVoid());
            for (String c : createdVmrsCodes) chain = chain.flatMap(v -> vmrsRepo.deleteById(c).replaceWithVoid());
            return chain;
        }));
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
        Client result = runBlocking(() -> Panache.withTransaction(() -> clientRepo.persist(c).replaceWith(c)));
        createdClients.add(result.id);
        return result;
    }

    Site seedSite(UUID clientId) {
        Site s = new Site();
        s.name = "Test Site " + UUID.randomUUID();
        s.lat = 51.5074;
        s.lng = -0.1278;
        Site result = runBlocking(() -> Panache.withTransaction(() ->
            clientRepo.findById(clientId).flatMap(client -> {
                s.client = client;
                return siteRepo.persist(s).replaceWith(s);
            })
        ));
        createdSites.add(result.id);
        return result;
    }

    Vehicle seedVehicle(UUID siteId) {
        Vehicle v = new Vehicle();
        v.make = "CAT";
        v.model = "320";
        v.serialNumber = "SN-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        v.vehicleClass = VehicleClass.EXCAVATOR;
        v.status = VehicleStatus.AVAILABLE;
        Vehicle result = runBlocking(() -> Panache.withTransaction(() ->
            siteRepo.findById(siteId).flatMap(site -> {
                v.site = site;
                return vehicleRepo.persist(v).replaceWith(v);
            })
        ));
        createdVehicles.add(result.id);
        return result;
    }

    VmrsCode seedVmrsCode() {
        VmrsCode vc = new VmrsCode();
        vc.code = UUID.randomUUID().toString().replace("-", "").substring(0, 9);
        vc.description = "Test service";
        vc.srtMinutes = 60;
        vc.difficultyFactor = BigDecimal.ONE;
        VmrsCode result = runBlocking(() -> Panache.withTransaction(() -> vmrsRepo.persist(vc).replaceWith(vc)));
        createdVmrsCodes.add(result.code);
        return result;
    }

    Mechanic seedMechanic() {
        Mechanic m = new Mechanic();
        m.fullName = "Test Mech " + UUID.randomUUID();
        m.status = MechanicStatus.IDLE;
        Mechanic result = runBlocking(() -> Panache.withTransaction(() -> mechanicRepo.persist(m).replaceWith(m)));
        createdMechanics.add(result.id);
        return result;
    }

    UUID seedOrder(ServiceOrderState state, UUID vehicleId, String vmrsCode,
                   UUID clientId, UUID siteId, UUID mechanicId) {
        ServiceOrder so = new ServiceOrder();
        so.title = "Schedule Test Order";
        so.state = state;
        so.estimatedMinutes = 60;

        UUID result = runBlocking(() -> Panache.withTransaction(() ->
            vehicleRepo.findById(vehicleId).flatMap(vehicle -> {
                so.vehicle = vehicle;
                return vmrsRepo.findById(vmrsCode);
            }).flatMap(vc -> {
                so.vmrsCode = vc;
                return clientRepo.findById(clientId);
            }).flatMap(client -> {
                so.client = client;
                return siteRepo.findById(siteId);
            }).flatMap(site -> {
                so.site = site;
                so.siteLocation = geo.point(site.lng, site.lat);
                return mechanicId != null
                    ? mechanicRepo.findById(mechanicId)
                    : Uni.createFrom().nullItem();
            }).flatMap(mechanic -> {
                so.mechanic = (Mechanic) mechanic;
                return repo.persist(so).replaceWith(so);
            }).map(s -> s.id)
        ));

        createdOrders.add(result);
        return result;
    }

    // ---------------------------------------------------------------------------
    // Test 1: schedule from APPROVED succeeds
    // ---------------------------------------------------------------------------

    @Test
    void schedule_fromApproved_succeeds() {
        Client client   = seedClient();
        Site site       = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vc     = seedVmrsCode();
        Mechanic mech   = seedMechanic();

        UUID orderId = seedOrder(ServiceOrderState.APPROVED, vehicle.id, vc.code,
                client.id, site.id, null);

        given()
            .contentType(ContentType.JSON)
            .body("{\"mechanicId\":\"" + mech.id + "\","
                    + "\"scheduledStartAt\":\"2026-06-01T08:00:00Z\","
                    + "\"scheduledEndAt\":\"2026-06-01T09:00:00Z\"}")
        .when()
            .post("/api/service-orders/{id}/schedule", orderId)
        .then()
            .statusCode(200)
            .body("state", equalTo("SCHEDULED"));
    }

    // ---------------------------------------------------------------------------
    // Test 2: schedule from REQUESTED returns 409
    // ---------------------------------------------------------------------------

    @Test
    void schedule_fromRequested_returns409() {
        Client client   = seedClient();
        Site site       = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vc     = seedVmrsCode();
        Mechanic mech   = seedMechanic();

        // Default initial state is REQUESTED
        UUID orderId = seedOrder(ServiceOrderState.REQUESTED, vehicle.id, vc.code,
                client.id, site.id, null);

        given()
            .contentType(ContentType.JSON)
            .body("{\"mechanicId\":\"" + mech.id + "\","
                    + "\"scheduledStartAt\":\"2026-06-01T08:00:00Z\","
                    + "\"scheduledEndAt\":\"2026-06-01T09:00:00Z\"}")
        .when()
            .post("/api/service-orders/{id}/schedule", orderId)
        .then()
            .statusCode(409);
    }

    // ---------------------------------------------------------------------------
    // Test 3: schedule with missing mechanicId returns 400
    // ---------------------------------------------------------------------------

    @Test
    void schedule_missingMechanic_returns400() {
        Client client   = seedClient();
        Site site       = seedSite(client.id);
        Vehicle vehicle = seedVehicle(site.id);
        VmrsCode vc     = seedVmrsCode();

        UUID orderId = seedOrder(ServiceOrderState.APPROVED, vehicle.id, vc.code,
                client.id, site.id, null);

        given()
            .contentType(ContentType.JSON)
            .body("{\"scheduledStartAt\":\"2026-06-01T08:00:00Z\","
                    + "\"scheduledEndAt\":\"2026-06-01T09:00:00Z\"}")
        .when()
            .post("/api/service-orders/{id}/schedule", orderId)
        .then()
            .statusCode(400);
    }
}
