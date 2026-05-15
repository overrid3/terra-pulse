package com.terrapulse.api;

import com.terrapulse.api.dto.SiteDtos.SiteDto;
import com.terrapulse.api.dto.SiteDtos.SiteUpsertDto;
import com.terrapulse.domain.service.ServiceOrderState;
import com.terrapulse.domain.site.Site;
import com.terrapulse.repository.ClientRepository;
import com.terrapulse.repository.ServiceOrderRepository;
import com.terrapulse.repository.SiteRepository;
import com.terrapulse.repository.VehicleRepository;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Path("/api/clients/{clientId}/sites")
@Produces(MediaType.APPLICATION_JSON)
public class SiteResource {

    @Inject SiteRepository repo;
    @Inject ClientRepository clientRepo;
    @Inject ServiceOrderRepository serviceOrderRepo;
    @Inject VehicleRepository vehicleRepo;

    @GET
    public List<SiteDto> list(@PathParam("clientId") UUID clientId) {
        if (clientRepo.findById(clientId) == null) throw new NotFoundException();
        return repo.findByClientId(clientId).stream()
                .map(s -> toDto(s))
                .toList();
    }

    @POST
    @Transactional
    public Response create(@PathParam("clientId") UUID clientId, SiteUpsertDto in) {
        var client = clientRepo.findById(clientId);
        if (client == null) throw new NotFoundException();
        if (in == null || in.name() == null || in.name().isBlank())
            throw new IllegalArgumentException("name required");

        Site site = new Site();
        site.client = client;
        site.name = in.name().trim();
        site.lat = in.lat();
        site.lng = in.lng();
        site.locationLabel = in.locationLabel();
        repo.persist(site);
        return Response.status(Response.Status.CREATED).entity(toDto(site)).build();
    }

    @PATCH
    @Path("/{siteId}")
    @Transactional
    public SiteDto patch(@PathParam("clientId") UUID clientId,
                         @PathParam("siteId") UUID siteId,
                         SiteUpsertDto in) {
        Site site = load(clientId, siteId);
        if (in.name() != null && !in.name().isBlank()) site.name = in.name().trim();
        if (in.lat() != null)           site.lat = in.lat();
        if (in.lng() != null)           site.lng = in.lng();
        if (in.locationLabel() != null) site.locationLabel = in.locationLabel();
        return toDto(site);
    }

    @DELETE
    @Path("/{siteId}")
    @Transactional
    public Response delete(@PathParam("clientId") UUID clientId,
                           @PathParam("siteId") UUID siteId) {
        Site site = load(clientId, siteId);
        long active = serviceOrderRepo.count(
                "site.id = ?1 and state != ?2 and state != ?3",
                site.id, ServiceOrderState.COMPLETED, ServiceOrderState.CANCELLED);
        if (active > 0)
            throw new WebApplicationException(
                    Response.status(Response.Status.CONFLICT)
                            .entity(Map.of("error", "site_has_active_orders",
                                           "message", "Cannot delete site with active orders"))
                            .build());
        repo.delete(site);
        return Response.noContent().build();
    }

    private Site load(UUID clientId, UUID siteId) {
        if (clientRepo.findById(clientId) == null) throw new NotFoundException();
        Site site = repo.findById(siteId);
        if (site == null || !site.client.id.equals(clientId)) throw new NotFoundException();
        return site;
    }

    private SiteDto toDto(Site s) {
        long openOrders = serviceOrderRepo.count(
                "site.id = ?1 and state != ?2 and state != ?3",
                s.id, ServiceOrderState.COMPLETED, ServiceOrderState.CANCELLED);
        long equipment = vehicleRepo.count("site.id = ?1", s.id);
        long personnel = (Long) repo.getEntityManager()
                .createQuery("select count(distinct so.mechanic.id) from ServiceOrder so " +
                             "where so.site.id = :siteId and so.mechanic is not null " +
                             "and (so.state = :dispatched or so.state = :inProgress)")
                .setParameter("siteId", s.id)
                .setParameter("dispatched", ServiceOrderState.DISPATCHED)
                .setParameter("inProgress", ServiceOrderState.IN_PROGRESS)
                .getSingleResult();
        return new SiteDto(s.id, s.client.id, s.name, s.lat, s.lng, s.locationLabel,
                openOrders, equipment, personnel, s.createdAt, s.updatedAt);
    }
}
