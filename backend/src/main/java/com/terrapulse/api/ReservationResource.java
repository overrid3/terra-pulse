package com.terrapulse.api;

import com.terrapulse.api.dto.ReservationDtos.ReservationCreateDto;
import com.terrapulse.api.dto.ReservationDtos.ReservationDto;
import com.terrapulse.api.dto.ReservationDtos.ReservationPatchDto;
import com.terrapulse.domain.client.Client;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.domain.reservation.DryHireReservation;
import com.terrapulse.domain.reservation.HireType;
import com.terrapulse.domain.reservation.Reservation;
import com.terrapulse.domain.reservation.ReservationStatus;
import com.terrapulse.domain.reservation.WetHireReservation;
import com.terrapulse.domain.vehicle.Vehicle;
import com.terrapulse.repository.ClientRepository;
import com.terrapulse.repository.MechanicRepository;
import com.terrapulse.repository.ReservationRepository;
import com.terrapulse.repository.VehicleRepository;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Path("/api/reservations")
@Produces(MediaType.APPLICATION_JSON)
public class ReservationResource {

    @Inject ReservationRepository repo;
    @Inject VehicleRepository vehicleRepo;
    @Inject MechanicRepository mechanicRepo;
    @Inject ClientRepository clientRepo;

    @GET
    public List<ReservationDto> list(@QueryParam("vehicleId") UUID vehicleId,
                                     @QueryParam("from") Instant from,
                                     @QueryParam("to") Instant to) {
        return repo.filter(vehicleId, from, to).stream().map(ReservationDto::of).toList();
    }

    @GET
    @Path("/{id}")
    public ReservationDto get(@PathParam("id") UUID id) {
        return ReservationDto.of(load(id));
    }

    @POST
    @Transactional
    public Response create(ReservationCreateDto in) {
        if (in.endAt().isBefore(in.startAt()) || in.endAt().equals(in.startAt())) {
            throw new IllegalArgumentException("endAt must be after startAt");
        }
        Vehicle vehicle = vehicleRepo.findById(in.vehicleId());
        if (vehicle == null) throw new IllegalArgumentException("vehicleId not found");
        if (in.clientId() == null) throw new IllegalArgumentException("clientId required");
        Client client = clientRepo.findById(in.clientId());
        if (client == null) throw new IllegalArgumentException("clientId not found");

        List<Reservation> overlaps = repo.findOverlapping(in.vehicleId(), in.startAt(), in.endAt());
        if (!overlaps.isEmpty()) {
            throw new WebApplicationException(
                    Response.status(Response.Status.CONFLICT)
                            .entity(java.util.Map.of("error", "reservation_overlap",
                                    "message", "vehicle has an overlapping reservation"))
                            .build());
        }

        Reservation r;
        if (in.hireType() == HireType.DRY_HIRE) {
            if (in.dailyRate() == null) throw new IllegalArgumentException("dailyRate required for DRY_HIRE");
            DryHireReservation d = new DryHireReservation();
            d.dailyRate = in.dailyRate();
            r = d;
        } else {
            if (in.hourlyRate() == null) throw new IllegalArgumentException("hourlyRate required for WET_HIRE");
            WetHireReservation w = new WetHireReservation();
            w.hourlyRate = in.hourlyRate();
            if (in.operatorMechanicId() != null) {
                Mechanic op = mechanicRepo.findById(in.operatorMechanicId());
                if (op == null) throw new IllegalArgumentException("operatorMechanicId not found");
                w.operatorMechanic = op;
            }
            r = w;
        }
        r.vehicle = vehicle;
        r.client = client;
        r.startAt = in.startAt();
        r.endAt = in.endAt();
        r.status = ReservationStatus.BOOKED;
        repo.persist(r);
        return Response.status(Response.Status.CREATED).entity(ReservationDto.of(r)).build();
    }

    @PATCH
    @Path("/{id}")
    @Transactional
    public ReservationDto patch(@PathParam("id") UUID id, ReservationPatchDto in) {
        Reservation r = load(id);
        if (in.status() != null) r.status = in.status();
        return ReservationDto.of(r);
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Reservation r = load(id);
        if (r.status != ReservationStatus.BOOKED) {
            throw new IllegalArgumentException("only BOOKED reservations can be deleted");
        }
        repo.delete(r);
        return Response.noContent().build();
    }

    private Reservation load(UUID id) {
        Reservation r = repo.findById(id);
        if (r == null) throw new NotFoundException();
        return r;
    }
}
