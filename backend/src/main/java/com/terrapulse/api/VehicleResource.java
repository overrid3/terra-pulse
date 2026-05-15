package com.terrapulse.api;

import com.terrapulse.api.dto.VehicleDtos.VehicleCreateDto;
import com.terrapulse.api.dto.VehicleDtos.VehicleDto;
import com.terrapulse.api.dto.VehicleDtos.VehiclePatchDto;
import com.terrapulse.api.dto.VehicleDtos.VehicleUpdateDto;
import com.terrapulse.domain.site.Site;
import com.terrapulse.domain.vehicle.Vehicle;
import com.terrapulse.repository.SiteRepository;
import com.terrapulse.repository.VehicleRepository;
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
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Path("/api/vehicles")
@Produces(MediaType.APPLICATION_JSON)
public class VehicleResource {

    @Inject
    VehicleRepository repo;

    @Inject
    SiteRepository siteRepo;

    @GET
    public List<VehicleDto> list() {
        return repo.listAll().stream().map(VehicleDto::of).toList();
    }

    @GET
    @Path("/{id}")
    public VehicleDto get(@PathParam("id") UUID id) {
        return VehicleDto.of(load(id));
    }

    @POST
    @Transactional
    public Response create(VehicleCreateDto in) {
        Vehicle v = new Vehicle();
        v.make = in.make();
        v.model = in.model();
        v.serialNumber = in.serialNumber();
        v.vehicleClass = in.vehicleClass();
        v.engineHours = in.engineHours() != null ? in.engineHours() : BigDecimal.ZERO;
        if (in.status() != null) v.status = in.status();
        repo.persist(v);
        return Response.status(Response.Status.CREATED).entity(VehicleDto.of(v)).build();
    }

    @PATCH
    @Path("/{id}")
    @Transactional
    public VehicleDto patch(@PathParam("id") UUID id, VehiclePatchDto in) {
        Vehicle v = load(id);
        if (in.engineHours() != null) v.engineHours = in.engineHours();
        if (in.status() != null) v.status = in.status();
        if (in.siteId() != null) {
            Site site = siteRepo.findById(in.siteId());
            if (site == null) throw new NotFoundException();
            v.site = site;
        }
        return VehicleDto.of(v);
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public VehicleDto update(@PathParam("id") UUID id, VehicleUpdateDto in) {
        Vehicle v = load(id);
        v.make = in.make();
        v.model = in.model();
        v.serialNumber = in.serialNumber();
        v.vehicleClass = in.vehicleClass();
        if (in.engineHours() != null) v.engineHours = in.engineHours();
        if (in.status() != null) v.status = in.status();
        return VehicleDto.of(v);
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        if (!repo.deleteById(id)) throw new NotFoundException();
        return Response.noContent().build();
    }

    private Vehicle load(UUID id) {
        Vehicle v = repo.findById(id);
        if (v == null) throw new NotFoundException();
        return v;
    }
}
