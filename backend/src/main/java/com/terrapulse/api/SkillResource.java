package com.terrapulse.api;

import com.terrapulse.domain.skill.Skill;
import com.terrapulse.repository.SkillRepository;
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
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.quarkus.security.Authenticated;

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
    public List<SkillDto> list() {
        return repo.findAllSorted().stream().map(SkillDto::of).toList();
    }

    @POST
    @Transactional
    public Response create(SkillUpsert in) {
        String name = sanitize(in == null ? null : in.name());
        if (repo.findByName(name).isPresent()) {
            throw new WebApplicationException("skill '" + name + "' already exists", Response.Status.CONFLICT);
        }
        Skill s = new Skill();
        s.name = name;
        repo.persist(s);
        return Response.status(Response.Status.CREATED).entity(SkillDto.of(s)).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public SkillDto rename(@PathParam("id") UUID id, SkillUpsert in) {
        String name = sanitize(in == null ? null : in.name());
        Skill s = repo.findById(id);
        if (s == null) throw new NotFoundException();
        repo.findByName(name).ifPresent(other -> {
            if (!other.id.equals(id))
                throw new WebApplicationException("skill '" + name + "' already exists",
                        Response.Status.CONFLICT);
        });
        s.name = name;
        return SkillDto.of(s);
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        if (!repo.deleteById(id)) throw new NotFoundException();
        return Response.noContent().build();
    }

    private static String sanitize(String in) {
        if (in == null) throw new IllegalArgumentException("name required");
        String trimmed = in.trim();
        if (trimmed.isEmpty()) throw new IllegalArgumentException("name required");
        if (trimmed.length() > 64) throw new IllegalArgumentException("name too long (max 64)");
        return trimmed;
    }
}
