package com.terrapulse.api;

import com.terrapulse.domain.skill.Skill;
import com.terrapulse.repository.SkillRepository;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Path("/api/skills")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class SkillResource {

    private final SkillRepository repo;

    @Inject
    public SkillResource(SkillRepository repo) {
        this.repo = repo;
    }

    public record SkillDto(UUID id, String name, Instant createdAt) {
        public static SkillDto of(Skill s) { return new SkillDto(s.id, s.name, s.createdAt); }
    }

    public record SkillUpsert(String name) {}

    @GET
    public Uni<List<SkillDto>> list() {
        return repo.findAllSorted().map(list -> list.stream().map(SkillDto::of).toList());
    }

    @POST
    @WithTransaction
    public Uni<Response> create(SkillUpsert in) {
        String name = sanitize(in == null ? null : in.name());
        return repo.findByName(name).flatMap(existing -> {
            if (existing != null) {
                throw new WebApplicationException("skill '" + name + "' already exists", Response.Status.CONFLICT);
            }
            Skill s = new Skill();
            s.name = name;
            return repo.persist(s).map(ignored ->
                    Response.status(Response.Status.CREATED).entity(SkillDto.of(s)).build());
        });
    }

    @PUT
    @Path("/{id}")
    @WithTransaction
    public Uni<SkillDto> rename(@PathParam("id") UUID id, SkillUpsert in) {
        String name = sanitize(in == null ? null : in.name());
        return Uni.combine().all().unis(
                repo.findById(id),
                repo.findByName(name)
        ).asTuple().map(t -> {
            Skill s = t.getItem1();
            if (s == null) throw new NotFoundException();
            Skill other = t.getItem2();
            if (other != null && !other.id.equals(id)) {
                throw new WebApplicationException("skill '" + name + "' already exists", Response.Status.CONFLICT);
            }
            s.name = name;
            return SkillDto.of(s);
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

    private static String sanitize(String in) {
        if (in == null) throw new IllegalArgumentException("name required");
        String trimmed = in.trim();
        if (trimmed.isEmpty()) throw new IllegalArgumentException("name required");
        if (trimmed.length() > 64) throw new IllegalArgumentException("name too long (max 64)");
        return trimmed;
    }
}
