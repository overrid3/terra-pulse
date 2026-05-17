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
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Path("/api/mechanics")
@Produces(MediaType.APPLICATION_JSON)
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
    public List<MechanicDto> list() {
        Set<UUID> onAbsence = mechanicsOnAbsenceNow();
        return repo.listAll().stream()
                .map(m -> MechanicDto.of(m, onAbsence.contains(m.id)))
                .toList();
    }

    @GET
    @Path("/nearest")
    public List<MechanicDto> nearest(@QueryParam("lat") double lat,
                                     @QueryParam("lng") double lng,
                                     @QueryParam("limit") Integer limit,
                                     @QueryParam("skill") String skill) {
        int lim = limit != null ? limit : 5;
        Set<UUID> onAbsence = mechanicsOnAbsenceNow();
        return nearest.findNearest(lat, lng, lim, skill).stream()
                .filter(m -> !onAbsence.contains(m.id))
                .map(m -> MechanicDto.of(m, false))
                .toList();
    }

    @GET
    @Path("/{id}")
    public MechanicDto get(@PathParam("id") UUID id) {
        Mechanic m = load(id);
        return MechanicDto.of(m, isOnAbsenceNow(m.id));
    }

    private Set<UUID> mechanicsOnAbsenceNow() {
        Instant now = Instant.now();
        return absenceRepo.findOverlapping(now, now).stream()
                .map(a -> a.mechanic.id)
                .collect(Collectors.toSet());
    }

    private boolean isOnAbsenceNow(UUID mechanicId) {
        return mechanicsOnAbsenceNow().contains(mechanicId);
    }

    @POST
    @Transactional
    public Response create(MechanicCreateDto in) {
        Mechanic m = new Mechanic();
        m.fullName = in.fullName();
        m.phone = in.phone();
        m.skills = resolveSkills(in.skills());
        if (in.status() != null) m.status = in.status();
        if (in.location() != null) {
            m.location = geo.point(in.location().lng(), in.location().lat());
            m.locationUpdatedAt = Instant.now();
        }
        repo.persist(m);
        return Response.status(Response.Status.CREATED).entity(MechanicDto.of(m)).build();
    }

    @PATCH
    @Path("/{id}")
    @Transactional
    public MechanicDto patch(@PathParam("id") UUID id, MechanicPatchDto in) {
        Mechanic m = load(id);
        if (in.fullName() != null) m.fullName = in.fullName();
        if (in.phone() != null)    m.phone = in.phone().isBlank() ? null : in.phone();
        if (in.skills() != null) {
            m.skills.clear();
            m.skills.addAll(resolveSkills(in.skills()));
        }
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
        return MechanicDto.of(m);
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        if (!repo.deleteById(id)) throw new NotFoundException();
        return Response.noContent().build();
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

    private Set<Skill> resolveSkills(List<String> names) {
        Set<Skill> out = new HashSet<>();
        if (names == null) return out;
        for (String n : names) {
            if (n == null) continue;
            String trimmed = n.trim();
            if (trimmed.isEmpty()) continue;
            out.add(skills.findOrCreate(trimmed));
        }
        return out;
    }

    private Mechanic load(UUID id) {
        Mechanic m = repo.findById(id);
        if (m == null) throw new NotFoundException();
        return m;
    }
}
