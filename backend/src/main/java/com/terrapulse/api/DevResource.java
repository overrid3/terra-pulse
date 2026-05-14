package com.terrapulse.api;

import com.terrapulse.api.dto.LatLng;
import com.terrapulse.api.dto.MechanicDtos.MechanicDto;
import com.terrapulse.api.dto.ServiceOrderDtos.SimulateMoveRequest;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.repository.MechanicRepository;
import io.quarkus.arc.profile.IfBuildProfile;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/dev")
@Produces(MediaType.APPLICATION_JSON)
@IfBuildProfile("dev")
public class DevResource {

    @Inject MechanicRepository mechanicRepo;
    @Inject MechanicResource mechanicResource;

    @POST
    @Path("/simulate-move")
    @Transactional
    public MechanicDto simulateMove(SimulateMoveRequest req) {
        Mechanic m = mechanicRepo.findById(req.mechanicId());
        if (m == null) throw new NotFoundException();
        mechanicResource.updateLocation(m, new LatLng(req.lat(), req.lng()));
        return MechanicDto.of(m);
    }
}
