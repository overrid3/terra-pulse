package com.terrapulse.api;

import com.terrapulse.api.dto.MechanicDtos.MechanicDto;
import com.terrapulse.domain.mechanic.AbsenceType;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.domain.mechanic.MechanicAbsence;
import com.terrapulse.domain.mechanic.MechanicStatus;
import com.terrapulse.domain.skill.Skill;
import com.terrapulse.repository.*;
import com.terrapulse.service.GeometrySupport;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@TestSecurity(authorizationEnabled = false)
class NearestMechanicTest {

    @Inject MechanicRepository mechanicRepo;
    @Inject MechanicAbsenceRepository absenceRepo;
    @Inject SkillRepository skillRepo;
    @Inject GeometrySupport geo;
    @Inject ServiceOrderRepository serviceOrderRepo;
    @Inject VehicleRepository vehicleRepo;
    @Inject SiteRepository siteRepo;
    @Inject ClientRepository clientRepo;

    private final List<UUID> createdMechanics = new ArrayList<>();
    private final List<UUID> createdAbsences = new ArrayList<>();
    private final List<UUID> createdSkills = new ArrayList<>();

    void clearAll() {
        Panache.withTransaction(() ->
            serviceOrderRepo.deleteAll()
                .flatMap(v -> absenceRepo.deleteAll())
                .flatMap(v -> mechanicRepo.deleteAll())
                .flatMap(v -> vehicleRepo.deleteAll())
                .flatMap(v -> siteRepo.deleteAll())
                .flatMap(v -> clientRepo.deleteAll())
                .flatMap(v -> skillRepo.deleteAll())
                .replaceWithVoid()
        ).await().indefinitely();
    }

    @AfterEach
    void cleanup() {
        clearAll();
        createdAbsences.clear();
        createdMechanics.clear();
        createdSkills.clear();
    }

    Mechanic seedMechanic(String name, double lat, double lng, String... skills) {
        Mechanic m = new Mechanic();
        m.fullName = name;
        m.status = MechanicStatus.IDLE;
        m.location = geo.point(lng, lat);
        m.locationUpdatedAt = Instant.now();

        Mechanic result = Panache.withTransaction(() -> {
            List<Uni<Skill>> skillUnis = Arrays.stream(skills)
                .map(skillRepo::findOrCreate)
                .collect(Collectors.toList());
            Uni<List<Skill>> resolvedSkills = skillUnis.isEmpty()
                ? Uni.createFrom().item(List.of())
                : Uni.join().all(skillUnis).andFailFast();
            return resolvedSkills.flatMap(skillList -> {
                m.skills.addAll(skillList);
                return mechanicRepo.persist(m).replaceWith(m);
            });
        }).await().indefinitely();

        createdMechanics.add(result.id);
        result.skills.forEach(s -> { if (!createdSkills.contains(s.id)) createdSkills.add(s.id); });
        return result;
    }

    void seedAbsence(UUID mechanicId, Instant start, Instant end) {
        MechanicAbsence a = new MechanicAbsence();
        a.startAt = start;
        a.endAt = end;
        a.type = AbsenceType.VACATION;

        MechanicAbsence result = Panache.withTransaction(() ->
            mechanicRepo.findById(mechanicId).flatMap(m -> {
                a.mechanic = m;
                return absenceRepo.persist(a).replaceWith(a);
            })
        ).await().indefinitely();

        createdAbsences.add(result.id);
    }

    @Test
    void testNearestMechanicSearch() {
        clearAll();
        // 1. Seed mechanics at different distances from a center point (0,0)
        // London: 51.5074, -0.1278
        seedMechanic("Near Mech", 51.5, -0.1, "Engine"); // Closest
        seedMechanic("Far Mech", 52.0, -0.5, "Hydraulics"); // Farther
        Mechanic absenceMech = seedMechanic("Absence Mech", 51.51, -0.11, "Engine"); // Very close but on absence
        
        seedAbsence(absenceMech.id, Instant.now().minus(1, ChronoUnit.HOURS), Instant.now().plus(1, ChronoUnit.HOURS));

        // 2. Query nearest from London center
        List<MechanicDto> results = given()
                .queryParam("lat", 51.5074)
                .queryParam("lng", -0.1278)
                .queryParam("limit", 5)
            .when()
                .get("/api/mechanics/nearest")
            .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .extract().body().jsonPath().getList(".", MechanicDto.class);

        // 3. Verify results
        assertThat(results, hasSize(2));
        assertThat(results.get(0).fullName(), equalTo("Near Mech"));
        assertThat(results.get(1).fullName(), equalTo("Far Mech"));
        
        // Verify absence mech is NOT in results
        boolean containsAbsenceMech = results.stream().anyMatch(m -> m.fullName().equals("Absence Mech"));
        assertThat(containsAbsenceMech, is(false));
    }

    @Test
    void testNearestMechanicWithSkillFilter() {
        clearAll();
        seedMechanic("Engine Specialist", 51.5, -0.1, "Engine");
        seedMechanic("Hydraulics Specialist", 51.51, -0.11, "Hydraulics");

        List<MechanicDto> results = given()
                .queryParam("lat", 51.5074)
                .queryParam("lng", -0.1278)
                .queryParam("skill", "Hydraulics")
            .when()
                .get("/api/mechanics/nearest")
            .then()
                .statusCode(200)
                .extract().body().jsonPath().getList(".", MechanicDto.class);

        assertThat(results, hasSize(1));
        assertThat(results.get(0).fullName(), equalTo("Hydraulics Specialist"));
    }

    @Test
    void testLimitRespectedWithUnavailables() {
        clearAll();
        // Seed 10 mechanics, all with "Engine" skill
        // We'll make the first 5 unavailable
        for (int i = 0; i < 10; i++) {
            Mechanic m = seedMechanic("Mech " + i, 51.5 + (i * 0.01), -0.1, "Engine");
            if (i < 5) {
                seedAbsence(m.id, Instant.now().minus(1, ChronoUnit.HOURS), Instant.now().plus(1, ChronoUnit.HOURS));
            }
        }

        // Query with limit 3
        List<MechanicDto> results = given()
                .queryParam("lat", 51.5)
                .queryParam("lng", -0.1)
                .queryParam("limit", 3)
            .when()
                .get("/api/mechanics/nearest")
            .then()
                .statusCode(200)
                .extract().body().jsonPath().getList(".", MechanicDto.class);

        // Should return 3 available mechanics (Mech 5, 6, 7)
        assertThat(results, hasSize(3));
        assertThat(results.get(0).fullName(), equalTo("Mech 5"));
        assertThat(results.get(1).fullName(), equalTo("Mech 6"));
        assertThat(results.get(2).fullName(), equalTo("Mech 7"));
    }
}
