package com.terrapulse.api;

import com.terrapulse.domain.mechanic.AbsenceType;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.domain.mechanic.MechanicAbsence;
import com.terrapulse.repository.MechanicAbsenceRepository;
import com.terrapulse.repository.MechanicRepository;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Path("/api/mechanic-absences")
@Produces(MediaType.APPLICATION_JSON)
public class MechanicAbsenceResource {

    private final MechanicRepository mechanics;
    private final MechanicAbsenceRepository absences;

    @Inject
    public MechanicAbsenceResource(MechanicRepository mechanics, MechanicAbsenceRepository absences) {
        this.mechanics = mechanics;
        this.absences = absences;
    }

    public record AbsenceDto(
            UUID id,
            UUID mechanicId,
            Instant startAt,
            Instant endAt,
            AbsenceType type,
            String reason,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static AbsenceDto of(MechanicAbsence a) {
            return new AbsenceDto(a.id, a.mechanic.id, a.startAt, a.endAt, a.type, a.reason,
                    a.createdAt, a.updatedAt);
        }
    }

    public record AbsenceUpsert(
            UUID mechanicId,
            Instant startAt,
            Instant endAt,
            AbsenceType type,
            String reason
    ) {}

    /**
     * Filter: pass either {@code mechanicId} (per-mechanic history) OR
     * {@code from}/{@code to} (overlap query for the dispatch board).
     * Passing nothing returns all absences (POC convenience).
     */
    @GET
    public List<AbsenceDto> list(@QueryParam("mechanicId") UUID mechanicId,
                                 @QueryParam("from") Instant from,
                                 @QueryParam("to") Instant to) {
        if (mechanicId != null) {
            return absences.findByMechanic(mechanicId).stream().map(AbsenceDto::of).toList();
        }
        if (from != null || to != null) {
            if (from == null || to == null) {
                throw new IllegalArgumentException("'from' and 'to' must be provided together");
            }
            if (!to.isAfter(from)) {
                throw new IllegalArgumentException("'to' must be after 'from'");
            }
            return absences.findOverlapping(from, to).stream().map(AbsenceDto::of).toList();
        }
        return absences.listAll().stream().map(AbsenceDto::of).toList();
    }

    @POST
    @Transactional
    public Response create(AbsenceUpsert in) {
        validate(in);
        Mechanic m = mechanics.findById(in.mechanicId());
        if (m == null) throw new IllegalArgumentException("mechanicId not found");
        MechanicAbsence a = new MechanicAbsence();
        a.mechanic = m;
        a.startAt = in.startAt();
        a.endAt = in.endAt();
        a.type = in.type();
        a.reason = blankToNull(in.reason());
        absences.persist(a);
        return Response.status(Response.Status.CREATED).entity(AbsenceDto.of(a)).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public AbsenceDto update(@PathParam("id") UUID id, AbsenceUpsert in) {
        MechanicAbsence a = absences.findById(id);
        if (a == null) throw new NotFoundException();
        validate(in);
        // mechanicId on PUT is optional — if provided + different, reassign.
        if (in.mechanicId() != null && !in.mechanicId().equals(a.mechanic.id)) {
            Mechanic m = mechanics.findById(in.mechanicId());
            if (m == null) throw new IllegalArgumentException("mechanicId not found");
            a.mechanic = m;
        }
        a.startAt = in.startAt();
        a.endAt = in.endAt();
        a.type = in.type();
        a.reason = blankToNull(in.reason());
        return AbsenceDto.of(a);
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        if (!absences.deleteById(id)) throw new NotFoundException();
        return Response.noContent().build();
    }

    private static void validate(AbsenceUpsert in) {
        if (in == null) throw new IllegalArgumentException("body required");
        if (in.startAt() == null || in.endAt() == null) {
            throw new IllegalArgumentException("startAt and endAt are required");
        }
        if (!in.endAt().isAfter(in.startAt())) {
            throw new IllegalArgumentException("endAt must be after startAt");
        }
        if (in.type() == null) throw new IllegalArgumentException("type required");
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
