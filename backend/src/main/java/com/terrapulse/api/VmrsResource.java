package com.terrapulse.api;

import com.terrapulse.domain.vmrs.VmrsCode;
import com.terrapulse.repository.VmrsCodeRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.math.BigDecimal;
import java.util.List;

import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;

@Path("/api/vmrs-codes")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class VmrsResource {

    public record VmrsCodeDto(String code, String description, int srtMinutes, BigDecimal difficultyFactor) {
        public static VmrsCodeDto of(VmrsCode v) {
            return new VmrsCodeDto(v.code, v.description, v.srtMinutes, v.difficultyFactor);
        }
    }

    private final VmrsCodeRepository repo;

    @Inject
    public VmrsResource(VmrsCodeRepository repo) {
        this.repo = repo;
    }

    @GET
    public Uni<List<VmrsCodeDto>> list() {
        return repo.listAll().map(list -> list.stream().map(VmrsCodeDto::of).toList());
    }
}
