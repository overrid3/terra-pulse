package com.terrapulse.api;

import com.terrapulse.api.dto.ClientDtos.ClientDto;
import com.terrapulse.api.dto.ClientDtos.ClientSummaryDto;
import com.terrapulse.api.dto.ClientDtos.ClientUpsertDto;
import com.terrapulse.domain.client.Client;
import com.terrapulse.domain.service.ServiceOrderState;
import com.terrapulse.repository.ClientRepository;
import com.terrapulse.repository.ServiceOrderRepository;
import com.terrapulse.repository.SiteRepository;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
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
import java.util.UUID;

@Path("/api/clients")
@Produces(MediaType.APPLICATION_JSON)
public class ClientResource {

    @Inject ClientRepository repo;
    @Inject SiteRepository siteRepo;
    @Inject ServiceOrderRepository serviceOrderRepo;

    @GET
    public List<ClientSummaryDto> list() {
        return repo.listAll().stream().map(c -> {
            long sites = siteRepo.count("client.id = ?1", c.id);
            long openOrders = serviceOrderRepo.count(
                    "client.id = ?1 and state != ?2 and state != ?3",
                    c.id, ServiceOrderState.COMPLETED, ServiceOrderState.CANCELLED);
            return new ClientSummaryDto(c.id, c.name, c.email, c.phone, c.vatNumber,
                    c.addressLine1, c.addressLine2, c.city, c.postalCode, c.country,
                    sites, openOrders, c.createdAt, c.updatedAt);
        }).toList();
    }

    @GET
    @Path("/{id}")
    public ClientDto get(@PathParam("id") UUID id) {
        return ClientDto.of(load(id));
    }

    @POST
    @Transactional
    public Response create(ClientUpsertDto in) {
        validate(in);
        if (repo.findByEmail(in.email()) != null) {
            throw new WebApplicationException(Response.status(Response.Status.CONFLICT)
                    .entity(java.util.Map.of("error", "duplicate_email", "message", "email already in use"))
                    .build());
        }
        Client c = new Client();
        copy(in, c);
        repo.persist(c);
        return Response.status(Response.Status.CREATED).entity(ClientDto.of(c)).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public ClientDto update(@PathParam("id") UUID id, ClientUpsertDto in) {
        validate(in);
        Client c = load(id);
        Client other = repo.findByEmail(in.email());
        if (other != null && !other.id.equals(c.id)) {
            throw new WebApplicationException(Response.status(Response.Status.CONFLICT)
                    .entity(java.util.Map.of("error", "duplicate_email", "message", "email already in use"))
                    .build());
        }
        copy(in, c);
        return ClientDto.of(c);
    }

    @PATCH
    @Path("/{id}")
    @Transactional
    public ClientDto patch(@PathParam("id") UUID id, ClientUpsertDto in) {
        Client c = load(id);
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
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        if (!repo.deleteById(id)) throw new NotFoundException();
        return Response.noContent().build();
    }

    private Client load(UUID id) {
        Client c = repo.findById(id);
        if (c == null) throw new NotFoundException();
        return c;
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
