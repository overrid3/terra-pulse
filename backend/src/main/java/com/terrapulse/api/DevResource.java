package com.terrapulse.api;

import com.terrapulse.api.dto.LatLng;
import com.terrapulse.api.dto.MechanicDtos.MechanicDto;
import com.terrapulse.api.dto.ServiceOrderDtos.SimulateMoveRequest;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.repository.MechanicRepository;
import io.quarkus.arc.profile.IfBuildProfile;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/dev")
@Produces(MediaType.APPLICATION_JSON)
@IfBuildProfile("dev")
public class DevResource {

    private final MechanicRepository mechanicRepo;
    private final MechanicResource mechanicResource;

    @Inject
    public DevResource(MechanicRepository mechanicRepo, MechanicResource mechanicResource) {
        this.mechanicRepo = mechanicRepo;
        this.mechanicResource = mechanicResource;
    }

    @POST
    @Path("/simulate-move")
    @WithTransaction
    public Uni<MechanicDto> simulateMove(SimulateMoveRequest req) {
        return mechanicRepo.findById(req.mechanicId()).map(m -> {
            if (m == null) throw new NotFoundException();
            mechanicResource.updateLocation(m, new LatLng(req.lat(), req.lng()));
            return MechanicDto.of(m);
        });
    }
}
