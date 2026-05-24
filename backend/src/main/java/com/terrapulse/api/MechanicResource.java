package com.terrapulse.api;

import com.terrapulse.api.dto.LatLng;
import com.terrapulse.api.dto.MechanicDtos.MechanicCreateDto;
import com.terrapulse.api.dto.MechanicDtos.MechanicDto;
import com.terrapulse.api.dto.MechanicDtos.MechanicPatchDto;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.domain.mechanic.MechanicStatus;
import com.terrapulse.domain.skill.Skill;
import com.terrapulse.repository.MechanicAbsenceRepository;
import com.terrapulse.repository.MechanicRepository;
import com.terrapulse.repository.SkillRepository;
import com.terrapulse.service.GeometrySupport;
import com.terrapulse.service.NearestMechanicService;
import com.terrapulse.ws.DispatchEvent;
import com.terrapulse.ws.DispatchEventBus;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Path("/api/mechanics")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class MechanicResource {

    private final MechanicRepository repo;
    private final MechanicAbsenceRepository absenceRepo;
    private final SkillRepository skills;
    private final GeometrySupport geo;
    private final NearestMechanicService nearest;
    private final DispatchEventBus bus;

    @Inject
    public MechanicResource(MechanicRepository repo,
                            MechanicAbsenceRepository absenceRepo,
                            SkillRepository skills,
                            GeometrySupport geo,
                            NearestMechanicService nearest,
                            DispatchEventBus bus) {
        this.repo = repo;
        this.absenceRepo = absenceRepo;
        this.skills = skills;
        this.geo = geo;
        this.nearest = nearest;
        this.bus = bus;
    }

    @GET
    public Uni<List<MechanicDto>> list() {
        Instant now = Instant.now();
        return Uni.combine().all().unis(
                repo.listAll(),
                absenceRepo.findOverlapping(now, now)
        ).asTuple().map(tuple -> {
            Set<UUID> onAbsence = tuple.getItem2().stream()
                    .map(a -> a.mechanic.id)
                    .collect(Collectors.toSet());
            return tuple.getItem1().stream()
                    .map(m -> MechanicDto.of(m, onAbsence.contains(m.id)))
                    .toList();
        });
    }

    @GET
    @Path("/nearest")
    public Uni<List<MechanicDto>> nearest(@QueryParam("lat") double lat,
                                          @QueryParam("lng") double lng,
                                          @QueryParam("limit") Integer limit,
                                          @QueryParam("skill") String skill) {
        int lim = limit != null ? limit : 5;
        return nearest.findNearest(lat, lng, lim, skill)
                .map(mechanics -> mechanics.stream().map(m -> MechanicDto.of(m, false)).toList());
    }

    @GET
    @Path("/{id}")
    public Uni<MechanicDto> get(@PathParam("id") UUID id) {
        Instant now = Instant.now();
        return Uni.combine().all().unis(
                load(id),
                absenceRepo.findOverlapping(now, now)
        ).asTuple().map(tuple -> {
            Mechanic m = tuple.getItem1();
            boolean onAbsence = tuple.getItem2().stream()
                    .anyMatch(a -> m.id.equals(a.mechanic.id));
            return MechanicDto.of(m, onAbsence);
        });
    }

    @POST
    @WithTransaction
    public Uni<Response> create(MechanicCreateDto in) {
        Mechanic m = new Mechanic();
        m.fullName = in.fullName();
        m.phone = in.phone();
        if (in.status() != null) m.status = in.status();
        if (in.location() != null) {
            m.location = geo.point(in.location().lng(), in.location().lat());
            m.locationUpdatedAt = Instant.now();
        }
        return resolveSkills(in.skills()).flatMap(skillSet -> {
            m.skills = skillSet;
            return repo.persist(m).replaceWith(
                    Response.status(Response.Status.CREATED).entity(MechanicDto.of(m)).build());
        });
    }

    @PATCH
    @Path("/{id}")
    @WithTransaction
    public Uni<MechanicDto> patch(@PathParam("id") UUID id, MechanicPatchDto in) {
        return load(id).flatMap(m -> {
            if (in.fullName() != null) m.fullName = in.fullName();
            if (in.phone() != null)    m.phone = in.phone().isBlank() ? null : in.phone();
            if (in.status() != null) {
                MechanicStatus from = m.status;
                m.status = in.status();
                if (from != m.status) {
                    bus.publish(DispatchEvent.of(DispatchEvent.MECHANIC_STATUS_CHANGED, Map.of(
                            "mechanicId", m.id,
                            "fromStatus", from,
                            "toStatus", m.status,
                            "updatedAt", Instant.now()
                    )));
                }
            }
            if (in.location() != null) updateLocation(m, in.location());

            if (in.skills() != null) {
                return resolveSkills(in.skills()).map(skillSet -> {
                    m.skills.clear();
                    m.skills.addAll(skillSet);
                    return MechanicDto.of(m);
                });
            }
            return Uni.createFrom().item(MechanicDto.of(m));
        });
    }

    @DELETE
    @Path("/{id}")
    @WithTransaction
    public Uni<Response> delete(@PathParam("id") UUID id) {
        return repo.deleteById(id).map(deleted -> {
            if (!deleted) throw new NotFoundException();
            return Response.noContent().build();
        });
    }

    public void updateLocation(Mechanic m, LatLng loc) {
        m.location = geo.point(loc.lng(), loc.lat());
        m.locationUpdatedAt = Instant.now();
        if (m.status == MechanicStatus.OFF_DUTY) m.status = MechanicStatus.IDLE;
        bus.publish(DispatchEvent.of(DispatchEvent.MECHANIC_LOCATION_UPDATED, Map.of(
                "mechanicId", m.id,
                "lat", loc.lat(),
                "lng", loc.lng(),
                "updatedAt", m.locationUpdatedAt
        )));
    }

    private Uni<Set<Skill>> resolveSkills(List<String> names) {
        if (names == null || names.isEmpty())
            return Uni.createFrom().item(new HashSet<>());

        List<String> filtered = names.stream()
                .filter(n -> n != null && !n.trim().isEmpty())
                .map(String::trim)
                .distinct()
                .toList();

        if (filtered.isEmpty())
            return Uni.createFrom().item(new HashSet<>());

        // Chain sequentially so each findOrCreate runs inside the same session
        Uni<List<Skill>> accumulated = Uni.createFrom().item(new ArrayList<>());
        for (String name : filtered) {
            final String skillName = name;
            accumulated = accumulated.flatMap(list ->
                    skills.findOrCreate(skillName).map(skill -> {
                        list.add(skill);
                        return list;
                    })
            );
        }
        return accumulated.map(HashSet::new);
    }

    private Uni<Mechanic> load(UUID id) {
        return repo.findById(id).map(m -> {
            if (m == null) throw new NotFoundException();
            return m;
        });
    }
}
