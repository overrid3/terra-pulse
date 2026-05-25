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
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.quarkus.security.Authenticated;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
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
import java.util.Map;
import java.util.UUID;

@Path("/api/reservations")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class ReservationResource {

    private final ReservationRepository repo;
    private final VehicleRepository vehicleRepo;
    private final MechanicRepository mechanicRepo;
    private final ClientRepository clientRepo;

    @Inject
    public ReservationResource(ReservationRepository repo,
                               VehicleRepository vehicleRepo,
                               MechanicRepository mechanicRepo,
                               ClientRepository clientRepo) {
        this.repo = repo;
        this.vehicleRepo = vehicleRepo;
        this.mechanicRepo = mechanicRepo;
        this.clientRepo = clientRepo;
    }

    @GET
    public Uni<List<ReservationDto>> list(@QueryParam("vehicleId") UUID vehicleId,
                                          @QueryParam("from") Instant from,
                                          @QueryParam("to") Instant to) {
        return repo.filter(vehicleId, from, to)
                .map(list -> list.stream().map(ReservationDto::of).toList());
    }

    @GET
    @Path("/{id}")
    public Uni<ReservationDto> get(@PathParam("id") UUID id) {
        return load(id).map(ReservationDto::of);
    }

    @POST
    @WithTransaction
    public Uni<Response> create(ReservationCreateDto in) {
        if (in.endAt().isBefore(in.startAt()) || in.endAt().equals(in.startAt())) {
            throw new IllegalArgumentException("endAt must be after startAt");
        }
        if (in.clientId() == null) throw new IllegalArgumentException("clientId required");

        return Uni.combine().all().unis(
                vehicleRepo.findById(in.vehicleId()),
                clientRepo.findById(in.clientId())
        ).asTuple().flatMap(t -> {
            Vehicle vehicle = t.getItem1();
            if (vehicle == null) throw new IllegalArgumentException("vehicleId not found");
            Client client = t.getItem2();
            if (client == null) throw new IllegalArgumentException("clientId not found");

            return repo.findOverlapping(in.vehicleId(), in.startAt(), in.endAt())
                    .flatMap(overlaps -> {
                        if (!overlaps.isEmpty()) {
                            throw new WebApplicationException(
                                    Response.status(Response.Status.CONFLICT)
                                            .entity(Map.of("error", "reservation_overlap",
                                                    "message", "vehicle has an overlapping reservation"))
                                            .build());
                        }

                        Reservation r;
                        if (in.hireType() == HireType.DRY_HIRE) {
                            if (in.dailyRate() == null)
                                throw new IllegalArgumentException("dailyRate required for DRY_HIRE");
                            DryHireReservation d = new DryHireReservation();
                            d.dailyRate = in.dailyRate();
                            r = d;
                        } else {
                            if (in.hourlyRate() == null)
                                throw new IllegalArgumentException("hourlyRate required for WET_HIRE");
                            WetHireReservation w = new WetHireReservation();
                            w.hourlyRate = in.hourlyRate();
                            r = w;
                        }
                        r.vehicle = vehicle;
                        r.client = client;
                        r.startAt = in.startAt();
                        r.endAt = in.endAt();
                        r.status = ReservationStatus.BOOKED;

                        if (in.hireType() == HireType.WET_HIRE && in.operatorMechanicId() != null) {
                            final WetHireReservation wet = (WetHireReservation) r;
                            return mechanicRepo.findById(in.operatorMechanicId()).flatMap(op -> {
                                if (op == null)
                                    throw new IllegalArgumentException("operatorMechanicId not found");
                                wet.operatorMechanic = op;
                                return repo.persist(wet).map(ignored ->
                                        Response.status(Response.Status.CREATED)
                                                .entity(ReservationDto.of(wet)).build());
                            });
                        }

                        final Reservation reservation = r;
                        return repo.persist(reservation).map(ignored ->
                                Response.status(Response.Status.CREATED)
                                        .entity(ReservationDto.of(reservation)).build());
                    });
        });
    }

    @PATCH
    @Path("/{id}")
    @WithTransaction
    public Uni<ReservationDto> patch(@PathParam("id") UUID id, ReservationPatchDto in) {
        return load(id).map(r -> {
            if (in.status() != null) r.status = in.status();
            return ReservationDto.of(r);
        });
    }

    @DELETE
    @Path("/{id}")
    @WithTransaction
    public Uni<Response> delete(@PathParam("id") UUID id) {
        return load(id).flatMap(r -> {
            if (r.status != ReservationStatus.BOOKED) {
                throw new IllegalArgumentException("only BOOKED reservations can be deleted");
            }
            return repo.delete(r).replaceWith(Response.noContent().build());
        });
    }

    private Uni<Reservation> load(UUID id) {
        return repo.findById(id).map(r -> {
            if (r == null) throw new NotFoundException();
            return r;
        });
    }
}
