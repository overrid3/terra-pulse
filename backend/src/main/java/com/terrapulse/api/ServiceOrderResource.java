package com.terrapulse.api;

import com.terrapulse.api.dto.ServiceOrderDtos.CompleteRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.DispatchRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.OverrideStateRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.ServiceOrderCreateDto;
import com.terrapulse.api.dto.ServiceOrderDtos.ServiceOrderDto;
import com.terrapulse.domain.client.Client;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.domain.service.ServiceOrder;
import com.terrapulse.domain.service.ServiceOrderState;
import com.terrapulse.domain.service.ServiceOrderStateMachine;
import com.terrapulse.domain.vehicle.Vehicle;
import com.terrapulse.domain.vmrs.VmrsCode;
import com.terrapulse.repository.ClientRepository;
import com.terrapulse.repository.MechanicRepository;
import com.terrapulse.repository.ServiceOrderRepository;
import com.terrapulse.repository.VehicleRepository;
import com.terrapulse.repository.VmrsCodeRepository;
import com.terrapulse.service.EstimationService;
import com.terrapulse.service.GeometrySupport;
import com.terrapulse.ws.DispatchEvent;
import com.terrapulse.ws.DispatchEventBus;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Path("/api/service-orders")
@Produces(MediaType.APPLICATION_JSON)
public class ServiceOrderResource {

    @Inject ServiceOrderRepository repo;
    @Inject VehicleRepository vehicleRepo;
    @Inject MechanicRepository mechanicRepo;
    @Inject ClientRepository clientRepo;
    @Inject VmrsCodeRepository vmrsRepo;
    @Inject EstimationService estimation;
    @Inject GeometrySupport geo;
    @Inject DispatchEventBus bus;

    @GET
    public List<ServiceOrderDto> list(@QueryParam("state") ServiceOrderState state,
                                      @QueryParam("mechanicId") UUID mechanicId,
                                      @QueryParam("vehicleId") UUID vehicleId) {
        return repo.filter(state, mechanicId, vehicleId).stream().map(ServiceOrderDto::of).toList();
    }

    @GET
    @Path("/{id}")
    public ServiceOrderDto get(@PathParam("id") UUID id) {
        return ServiceOrderDto.of(load(id));
    }

    @POST
    @Transactional
    public Response create(ServiceOrderCreateDto in) {
        Vehicle v = vehicleRepo.findById(in.vehicleId());
        if (v == null) throw new IllegalArgumentException("vehicleId not found");
        VmrsCode c = vmrsRepo.findById(in.vmrsCode());
        if (c == null) throw new IllegalArgumentException("vmrsCode not found");
        if (in.siteLocation() == null) throw new IllegalArgumentException("siteLocation required");

        ServiceOrder so = new ServiceOrder();
        so.vehicle = v;
        so.vmrsCode = c;
        if (in.clientId() != null) {
            Client client = clientRepo.findById(in.clientId());
            if (client == null) throw new IllegalArgumentException("clientId not found");
            so.client = client;
        }
        so.siteLocation = geo.point(in.siteLocation().lng(), in.siteLocation().lat());
        so.notes = in.notes();
        // Estimation runs at creation so a default is available before QUOTED transition.
        so.estimatedMinutes = estimation.estimateMinutes(c);
        so.state = ServiceOrderState.REQUESTED;
        repo.persist(so);
        ServiceOrderDto dto = ServiceOrderDto.of(so);
        bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_CREATED, dto));
        return Response.status(Response.Status.CREATED).entity(dto).build();
    }

    private ServiceOrderDto applyTransition(ServiceOrder so, ServiceOrderState target) {
        ServiceOrderState from = so.state;
        ServiceOrderStateMachine.transitionTo(so, target);
        ServiceOrderDto dto = ServiceOrderDto.of(so);
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", so.id);
        payload.put("fromState", from);
        payload.put("toState", so.state);
        payload.put("mechanicId", so.mechanic != null ? so.mechanic.id : null);
        payload.put("dispatchedAt", so.dispatchedAt);
        payload.put("startedAt", so.startedAt);
        payload.put("completedAt", so.completedAt);
        payload.put("actualMinutes", so.actualMinutes);
        payload.put("estimatedMinutes", so.estimatedMinutes);
        bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_STATE_CHANGED, payload));
        return dto;
    }

    @POST
    @Path("/{id}/quote")
    @Transactional
    public ServiceOrderDto quote(@PathParam("id") UUID id) {
        ServiceOrder so = load(id);
        so.estimatedMinutes = estimation.estimateMinutes(so.vmrsCode);
        return applyTransition(so, ServiceOrderState.QUOTED);
    }

    @POST
    @Path("/{id}/approve")
    @Transactional
    public ServiceOrderDto approve(@PathParam("id") UUID id) {
        return applyTransition(load(id), ServiceOrderState.APPROVED);
    }

    @POST
    @Path("/{id}/dispatch")
    @Transactional
    public ServiceOrderDto dispatch(@PathParam("id") UUID id, DispatchRequest in) {
        if (in == null || in.mechanicId() == null) {
            throw new IllegalArgumentException("mechanicId required");
        }
        Mechanic m = mechanicRepo.findById(in.mechanicId());
        if (m == null) throw new IllegalArgumentException("mechanicId not found");
        ServiceOrder so = load(id);
        so.mechanic = m;
        return applyTransition(so, ServiceOrderState.DISPATCHED);
    }

    @POST
    @Path("/{id}/start")
    @Transactional
    public ServiceOrderDto start(@PathParam("id") UUID id) {
        return applyTransition(load(id), ServiceOrderState.IN_PROGRESS);
    }

    @POST
    @Path("/{id}/complete")
    @Transactional
    public ServiceOrderDto complete(@PathParam("id") UUID id, CompleteRequest in) {
        if (in == null || in.actualMinutes() == null) {
            throw new IllegalArgumentException("actualMinutes required");
        }
        ServiceOrder so = load(id);
        so.actualMinutes = in.actualMinutes();
        return applyTransition(so, ServiceOrderState.COMPLETED);
    }

    @POST
    @Path("/{id}/cancel")
    @Transactional
    public ServiceOrderDto cancel(@PathParam("id") UUID id) {
        return applyTransition(load(id), ServiceOrderState.CANCELLED);
    }

    @POST
    @Path("/{id}/override-state")
    @Transactional
    public ServiceOrderDto overrideState(@PathParam("id") UUID id, OverrideStateRequest in) {
        if (in == null || in.state() == null) {
            throw new IllegalArgumentException("state required");
        }
        ServiceOrderState target = in.state();
        if (target != ServiceOrderState.CANCELLED && target != ServiceOrderState.REQUESTED) {
            throw new IllegalArgumentException(
                    "override only allowed to CANCELLED or REQUESTED (got " + target + ")");
        }
        ServiceOrder so = load(id);
        ServiceOrderState from = so.state;

        String reason = (in.reason() == null || in.reason().isBlank()) ? "no reason given" : in.reason();
        String entry = "[override " + java.time.Instant.now() + "] " + from + " -> " + target + ": " + reason;
        so.notes = (so.notes == null || so.notes.isBlank()) ? entry : so.notes + "\n" + entry;

        if (target == ServiceOrderState.REQUESTED) {
            // Reopen: detach mechanic + clear lifecycle timestamps so the workflow restarts cleanly.
            so.mechanic = null;
            so.dispatchedAt = null;
            so.startedAt = null;
            so.completedAt = null;
            so.actualMinutes = null;
        }
        so.state = target;

        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("id", so.id);
        payload.put("fromState", from);
        payload.put("toState", target);
        payload.put("override", true);
        payload.put("reason", reason);
        bus.publish(com.terrapulse.ws.DispatchEvent.of(
                com.terrapulse.ws.DispatchEvent.SERVICE_ORDER_STATE_CHANGED, payload));
        return ServiceOrderDto.of(so);
    }

    private ServiceOrder load(UUID id) {
        ServiceOrder so = repo.findById(id);
        if (so == null) throw new NotFoundException();
        return so;
    }
}
