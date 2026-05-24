package com.terrapulse.api;

import com.terrapulse.api.dto.SiteDtos.SiteDto;
import com.terrapulse.api.dto.SiteDtos.SiteUpsertDto;
import com.terrapulse.domain.service.ServiceOrderState;
import com.terrapulse.domain.site.Site;
import com.terrapulse.repository.ClientRepository;
import com.terrapulse.repository.ServiceOrderRepository;
import com.terrapulse.repository.SiteRepository;
import com.terrapulse.repository.VehicleRepository;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Path("/api/clients/{clientId}/sites")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class SiteResource {

    private final SiteRepository repo;
    private final ClientRepository clientRepo;
    private final ServiceOrderRepository serviceOrderRepo;
    private final VehicleRepository vehicleRepo;

    @Inject
    public SiteResource(SiteRepository repo,
                        ClientRepository clientRepo,
                        ServiceOrderRepository serviceOrderRepo,
                        VehicleRepository vehicleRepo) {
        this.repo = repo;
        this.clientRepo = clientRepo;
        this.serviceOrderRepo = serviceOrderRepo;
        this.vehicleRepo = vehicleRepo;
    }

    @GET
    public Uni<List<SiteDto>> list(@PathParam("clientId") UUID clientId) {
        return clientRepo.findById(clientId).flatMap(client -> {
            if (client == null) throw new NotFoundException();
            return repo.findByClientId(clientId)
                    .flatMap(sites -> {
                        // Build Uni<SiteDto> for each site, then collect
                        List<Uni<SiteDto>> dtoUnis = sites.stream().map(this::toDto).toList();
                        if (dtoUnis.isEmpty()) return Uni.createFrom().item(List.of());
                        return Uni.combine().all().unis(dtoUnis)
                                .combinedWith(objs -> objs.stream().map(o -> (SiteDto) o).toList());
                    });
        });
    }

    @POST
    @WithTransaction
    public Uni<Response> create(@PathParam("clientId") UUID clientId, SiteUpsertDto in) {
        if (in == null || in.name() == null || in.name().isBlank())
            throw new IllegalArgumentException("name required");
        return clientRepo.findById(clientId).flatMap(client -> {
            if (client == null) throw new NotFoundException();
            Site site = new Site();
            site.client = client;
            site.name = in.name().trim();
            site.lat = in.lat();
            site.lng = in.lng();
            site.locationLabel = in.locationLabel();
            return repo.persist(site).flatMap(v -> toDto(site).map(dto ->
                    Response.status(Response.Status.CREATED).entity(dto).build()));
        });
    }

    @PATCH
    @Path("/{siteId}")
    @WithTransaction
    public Uni<SiteDto> patch(@PathParam("clientId") UUID clientId,
                              @PathParam("siteId") UUID siteId,
                              SiteUpsertDto in) {
        return load(clientId, siteId).flatMap(site -> {
            if (in.name() != null && !in.name().isBlank()) site.name = in.name().trim();
            if (in.lat() != null)           site.lat = in.lat();
            if (in.lng() != null)           site.lng = in.lng();
            if (in.locationLabel() != null) site.locationLabel = in.locationLabel();
            return toDto(site);
        });
    }

    @DELETE
    @Path("/{siteId}")
    @WithTransaction
    public Uni<Response> delete(@PathParam("clientId") UUID clientId,
                                @PathParam("siteId") UUID siteId) {
        return load(clientId, siteId).flatMap(site ->
                serviceOrderRepo.count(
                        "site.id = ?1 and state != ?2 and state != ?3",
                        site.id, ServiceOrderState.COMPLETED, ServiceOrderState.CANCELLED)
                        .flatMap(active -> {
                            if (active > 0)
                                throw new WebApplicationException(
                                        Response.status(Response.Status.CONFLICT)
                                                .entity(Map.of("error", "site_has_active_orders",
                                                        "message", "Cannot delete site with active orders"))
                                                .build());
                            return repo.delete(site).replaceWith(Response.noContent().build());
                        })
        );
    }

    private Uni<Site> load(UUID clientId, UUID siteId) {
        return clientRepo.findById(clientId).flatMap(client -> {
            if (client == null) throw new NotFoundException();
            return repo.findById(siteId).map(site -> {
                if (site == null || !site.client.id.equals(clientId)) throw new NotFoundException();
                return site;
            });
        });
    }

    private Uni<SiteDto> toDto(Site s) {
        Uni<Long> openOrdersUni = serviceOrderRepo.count(
                "site.id = ?1 and state != ?2 and state != ?3",
                s.id, ServiceOrderState.COMPLETED, ServiceOrderState.CANCELLED);
        Uni<Long> equipmentUni = vehicleRepo.count("site.id = ?1", s.id);
        // Count distinct active mechanics via list + stream (reactive-safe for POC)
        Uni<Long> personnelUni = serviceOrderRepo.list(
                "site.id = ?1 and mechanic is not null and (state = ?2 or state = ?3)",
                s.id, ServiceOrderState.SCHEDULED, ServiceOrderState.IN_PROGRESS)
                .map(orders -> (long) orders.stream()
                        .map(so -> so.mechanic.id)
                        .distinct()
                        .count());

        return Uni.combine().all().unis(openOrdersUni, equipmentUni, personnelUni).asTuple()
                .map(t -> new SiteDto(s.id, s.client.id, s.name, s.lat, s.lng, s.locationLabel,
                        t.getItem1(), t.getItem2(), t.getItem3(), s.createdAt, s.updatedAt));
    }
}
