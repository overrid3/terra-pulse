package com.terrapulse.api;

import com.terrapulse.api.dto.ClientDtos.ClientDto;
import com.terrapulse.api.dto.ClientDtos.ClientStateChangeDto;
import com.terrapulse.api.dto.ClientDtos.ClientSummaryDto;
import com.terrapulse.api.dto.ClientDtos.ClientUpsertDto;
import com.terrapulse.domain.client.Client;
import com.terrapulse.domain.client.ClientState;
import com.terrapulse.domain.service.ServiceOrderState;
import com.terrapulse.repository.ClientRepository;
import com.terrapulse.repository.ServiceOrderRepository;
import com.terrapulse.repository.SiteRepository;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.groups.UniAndGroup2;
import jakarta.inject.Inject;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Path("/api/clients")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class ClientResource {

    private final ClientRepository repo;
    private final SiteRepository siteRepo;
    private final ServiceOrderRepository serviceOrderRepo;

    @Inject
    public ClientResource(ClientRepository repo,
                          SiteRepository siteRepo,
                          ServiceOrderRepository serviceOrderRepo) {
        this.repo = repo;
        this.siteRepo = siteRepo;
        this.serviceOrderRepo = serviceOrderRepo;
    }

    @GET
    public Uni<List<ClientSummaryDto>> list() {
        return repo.listAll().onItem()
                .transformToMulti(l -> Multi.createFrom().iterable(l))
                .onItem().transformToUniAndMerge(p -> getUnis(p).with((a, b) -> ClientSummaryDto.of(p, a, b)))
                .collect().asList();
    }

    private UniAndGroup2<Long, Long> getUnis(Client c) {
        return Uni.combine().all().unis(
                siteCount(c),
                serviceOrderCount(c)
        );
    }

    private Uni<Long> serviceOrderCount(Client c) {
        return serviceOrderRepo.count(
                "client.id = ?1 and state != ?2 and state != ?3",
                c.id, ServiceOrderState.COMPLETED, ServiceOrderState.CANCELLED);
    }

    private Uni<Long> siteCount(Client c) {
        return siteRepo.count("client.id = ?1", c.id);
    }

    @GET
    @Path("/{id}")
    public Uni<ClientDto> get(@PathParam("id") UUID id) {
        return load(id).map(ClientDto::of);
    }

    @POST
    @WithTransaction
    public Uni<Response> create(ClientUpsertDto in) {
        validate(in);
        return repo.findByEmail(in.email()).flatMap(existing -> {
            if (existing != null) {
                throw new WebApplicationException(Response.status(Response.Status.CONFLICT)
                        .entity(Map.of("error", "duplicate_email", "message", "email already in use"))
                        .build());
            }
            Client c = new Client();
            copy(in, c);
            return repo.persist(c).replaceWith(
                    Response.status(Response.Status.CREATED).entity(ClientDto.of(c)).build());
        });
    }

    @PUT
    @Path("/{id}")
    @WithTransaction
    public Uni<ClientDto> update(@PathParam("id") UUID id, ClientUpsertDto in) {
        validate(in);
        return Uni.combine().all().unis(load(id), repo.findByEmail(in.email()))
                .asTuple()
                .map(t -> {
                    Client c = t.getItem1();
                    Client other = t.getItem2();
                    if (other != null && !other.id.equals(c.id)) {
                        throw new WebApplicationException(Response.status(Response.Status.CONFLICT)
                                .entity(Map.of("error", "duplicate_email", "message", "email already in use"))
                                .build());
                    }
                    copy(in, c);
                    return ClientDto.of(c);
                });
    }

    @PUT
    @Path("/{id}/state")
    @WithTransaction
    public Uni<ClientDto> setState(@PathParam("id") UUID id, ClientStateChangeDto in) {
        if (in == null || in.state() == null)
            throw new IllegalArgumentException("state required");

        return load(id).flatMap(c -> {
            if (in.state() == ClientState.INACTIVE && c.state == ClientState.ACTIVE) {
                return serviceOrderCount(c).map(openOrders -> {
                    if (openOrders > 0) {
                        throw new WebApplicationException(Response.status(Response.Status.CONFLICT)
                                .entity(Map.of(
                                        "error", "client_has_open_orders",
                                        "message", "Cannot deactivate client with " + openOrders + " open order(s)",
                                        "openOrders", openOrders))
                                .build());
                    }
                    c.state = in.state();
                    return ClientDto.of(c);
                });
            }
            c.state = in.state();
            return Uni.createFrom().item(ClientDto.of(c));
        });
    }

    @PATCH
    @Path("/{id}")
    @WithTransaction
    public Uni<ClientDto> patch(@PathParam("id") UUID id, ClientUpsertDto in) {
        return load(id).map(c -> {
            if (in.name() != null)         c.name = in.name();
            if (in.email() != null)        c.email = in.email();
            if (in.phone() != null)        c.phone = in.phone();
            if (in.vatNumber() != null)    c.vatNumber = in.vatNumber();
            if (in.addressLine1() != null) c.addressLine1 = in.addressLine1();
            if (in.addressLine2() != null) c.addressLine2 = in.addressLine2();
            if (in.city() != null)         c.city = in.city();
            if (in.postalCode() != null)   c.postalCode = in.postalCode();
            if (in.country() != null)      c.country = in.country();
            return ClientDto.of(c);
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

    private Uni<Client> load(UUID id) {
        return repo.findById(id).map(c -> {
            if (c == null) throw new NotFoundException();
            return c;
        });
    }

    private void validate(ClientUpsertDto in) {
        if (in == null || in.name() == null || in.name().isBlank()) {
            throw new IllegalArgumentException("name required");
        }
        if (in.email() == null || in.email().isBlank()) {
            throw new IllegalArgumentException("email required");
        }
    }

    private void copy(ClientUpsertDto in, Client c) {
        c.name = in.name();
        c.email = in.email();
        c.phone = in.phone();
        c.vatNumber = in.vatNumber();
        c.addressLine1 = in.addressLine1();
        c.addressLine2 = in.addressLine2();
        c.city = in.city();
        c.postalCode = in.postalCode();
        c.country = in.country();
    }
}
