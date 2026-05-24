package com.terrapulse.api;

import com.terrapulse.api.dto.VehicleDtos.VehicleCreateDto;
import com.terrapulse.api.dto.VehicleDtos.VehicleDto;
import com.terrapulse.api.dto.VehicleDtos.VehiclePatchDto;
import com.terrapulse.api.dto.VehicleDtos.VehicleUpdateDto;
import com.terrapulse.domain.vehicle.Vehicle;
import com.terrapulse.repository.SiteRepository;
import com.terrapulse.repository.VehicleRepository;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
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
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Path("/api/vehicles")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class VehicleResource {

    private final VehicleRepository repo;
    private final SiteRepository siteRepo;

    @Inject
    public VehicleResource(VehicleRepository repo, SiteRepository siteRepo) {
        this.repo = repo;
        this.siteRepo = siteRepo;
    }

    @GET
    public Uni<List<VehicleDto>> list() {
        return repo.listAll().map(list -> list.stream().map(VehicleDto::of).toList());
    }

    @GET
    @Path("/{id}")
    public Uni<VehicleDto> get(@PathParam("id") UUID id) {
        return load(id).map(VehicleDto::of);
    }

    @POST
    @WithTransaction
    public Uni<Response> create(VehicleCreateDto in) {
        Vehicle v = new Vehicle();
        v.make = in.make();
        v.model = in.model();
        v.serialNumber = in.serialNumber();
        v.vehicleClass = in.vehicleClass();
        v.engineHours = in.engineHours() != null ? in.engineHours() : BigDecimal.ZERO;
        if (in.status() != null) v.status = in.status();
        return repo.persist(v).replaceWith(
                Response.status(Response.Status.CREATED).entity(VehicleDto.of(v)).build());
    }

    @PATCH
    @Path("/{id}")
    @WithTransaction
    public Uni<VehicleDto> patch(@PathParam("id") UUID id, VehiclePatchDto in) {
        return load(id).flatMap(v -> {
            if (in.engineHours() != null) v.engineHours = in.engineHours();
            if (in.status() != null) v.status = in.status();
            if (in.siteId() != null) {
                return siteRepo.findById(in.siteId()).map(site -> {
                    if (site == null) throw new NotFoundException();
                    v.site = site;
                    return VehicleDto.of(v);
                });
            }
            return Uni.createFrom().item(VehicleDto.of(v));
        });
    }

    @PUT
    @Path("/{id}")
    @WithTransaction
    public Uni<VehicleDto> update(@PathParam("id") UUID id, VehicleUpdateDto in) {
        return load(id).map(v -> {
            v.make = in.make();
            v.model = in.model();
            v.serialNumber = in.serialNumber();
            v.vehicleClass = in.vehicleClass();
            if (in.engineHours() != null) v.engineHours = in.engineHours();
            if (in.status() != null) v.status = in.status();
            return VehicleDto.of(v);
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

    private Uni<Vehicle> load(UUID id) {
        return repo.findById(id).map(v -> {
            if (v == null) throw new NotFoundException();
            return v;
        });
    }
}
