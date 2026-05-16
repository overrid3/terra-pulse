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

@Path("/api/vmrs-codes")
@Produces(MediaType.APPLICATION_JSON)
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
    public List<VmrsCodeDto> list() {
        return repo.listAll().stream().map(VmrsCodeDto::of).toList();
    }
}
