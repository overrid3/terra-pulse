package com.terrapulse.api;

import com.terrapulse.domain.mechanic.AbsenceType;
import com.terrapulse.domain.mechanic.MechanicAbsence;
import com.terrapulse.repository.MechanicAbsenceRepository;
import com.terrapulse.repository.MechanicRepository;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Path("/api/mechanic-absences")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
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

    @GET
    public Uni<List<AbsenceDto>> list(@QueryParam("mechanicId") UUID mechanicId,
                                      @QueryParam("from") Instant from,
                                      @QueryParam("to") Instant to) {
        if (mechanicId != null) {
            return absences.findByMechanic(mechanicId)
                    .map(list -> list.stream().map(AbsenceDto::of).toList());
        }
        if (from != null || to != null) {
            if (from == null || to == null) {
                throw new IllegalArgumentException("'from' and 'to' must be provided together");
            }
            if (!to.isAfter(from)) {
                throw new IllegalArgumentException("'to' must be after 'from'");
            }
            return absences.findOverlapping(from, to)
                    .map(list -> list.stream().map(AbsenceDto::of).toList());
        }
        return absences.listAll()
                .map(list -> list.stream().map(AbsenceDto::of).toList());
    }

    @POST
    @WithTransaction
    public Uni<Response> create(AbsenceUpsert in) {
        validate(in);
        return mechanics.findById(in.mechanicId()).flatMap(m -> {
            if (m == null) throw new IllegalArgumentException("mechanicId not found");
            MechanicAbsence a = new MechanicAbsence();
            a.mechanic = m;
            a.startAt = in.startAt();
            a.endAt = in.endAt();
            a.type = in.type();
            a.reason = blankToNull(in.reason());
            return absences.persist(a).replaceWith(
                    Response.status(Response.Status.CREATED).entity(AbsenceDto.of(a)).build());
        });
    }

    @PUT
    @Path("/{id}")
    @WithTransaction
    public Uni<AbsenceDto> update(@PathParam("id") UUID id, AbsenceUpsert in) {
        return absences.findById(id).flatMap(a -> {
            if (a == null) throw new NotFoundException();
            validate(in);
            if (in.mechanicId() != null && !in.mechanicId().equals(a.mechanic.id)) {
                return mechanics.findById(in.mechanicId()).map(m -> {
                    if (m == null) throw new IllegalArgumentException("mechanicId not found");
                    a.mechanic = m;
                    applyUpsert(a, in);
                    return AbsenceDto.of(a);
                });
            }
            applyUpsert(a, in);
            return Uni.createFrom().item(AbsenceDto.of(a));
        });
    }

    @DELETE
    @Path("/{id}")
    @WithTransaction
    public Uni<Response> delete(@PathParam("id") UUID id) {
        return absences.deleteById(id).map(deleted -> {
            if (!deleted) throw new NotFoundException();
            return Response.noContent().build();
        });
    }

    private static void applyUpsert(MechanicAbsence a, AbsenceUpsert in) {
        a.startAt = in.startAt();
        a.endAt = in.endAt();
        a.type = in.type();
        a.reason = blankToNull(in.reason());
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
