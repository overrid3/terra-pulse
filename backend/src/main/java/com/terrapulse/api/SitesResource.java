package com.terrapulse.api;

import com.terrapulse.api.dto.SiteDtos.SiteRefDto;
import com.terrapulse.repository.SiteRepository;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;

import io.quarkus.security.Authenticated;

@Path("/api/sites")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class SitesResource {

    private final SiteRepository repo;

    @Inject
    public SitesResource(SiteRepository repo) {
        this.repo = repo;
    }

    @GET
    public List<SiteRefDto> list() {
        return repo.listAll().stream()
                .map(s -> new SiteRefDto(
                        s.id,
                        s.client.id,
                        s.client.name,
                        s.name,
                        s.locationLabel))
                .toList();
    }
}
