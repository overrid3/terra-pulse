package com.terrapulse.api;

import com.terrapulse.api.dto.ServiceOrderDtos.CompleteRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.DispatchRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.OverrideStateRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.PatchScheduleRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.ScheduleRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.ServiceOrderCreateDto;
import com.terrapulse.api.dto.ServiceOrderDtos.ServiceOrderDto;
import com.terrapulse.api.dto.ServiceOrderDtos.TitleUpdateDto;
import com.terrapulse.domain.client.Client;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.domain.service.ServiceOrder;
import com.terrapulse.domain.service.ServiceOrderState;
import com.terrapulse.domain.service.ServiceOrderStateMachine;
import com.terrapulse.domain.site.Site;
import com.terrapulse.domain.vehicle.Vehicle;
import com.terrapulse.domain.vmrs.VmrsCode;
import com.terrapulse.repository.ClientRepository;
import com.terrapulse.repository.MechanicRepository;
import com.terrapulse.repository.ServiceOrderRepository;
import com.terrapulse.repository.SiteRepository;
import com.terrapulse.repository.VehicleRepository;
import com.terrapulse.repository.VmrsCodeRepository;
import com.terrapulse.service.EstimationParser;
import com.terrapulse.service.EstimationService;
import com.terrapulse.service.GeometrySupport;
import com.terrapulse.service.TitleGenerator;
import com.terrapulse.ws.DispatchEvent;
import com.terrapulse.ws.DispatchEventBus;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
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

    private final ServiceOrderRepository repo;
    private final VehicleRepository vehicleRepo;
    private final MechanicRepository mechanicRepo;
    private final ClientRepository clientRepo;
    private final VmrsCodeRepository vmrsRepo;
    private final SiteRepository siteRepo;
    private final EstimationService estimation;
    private final GeometrySupport geo;
    private final TitleGenerator titleGenerator;
    private final DispatchEventBus bus;

    @Inject
    public ServiceOrderResource(ServiceOrderRepository repo,
                                VehicleRepository vehicleRepo,
                                MechanicRepository mechanicRepo,
                                ClientRepository clientRepo,
                                VmrsCodeRepository vmrsRepo,
                                SiteRepository siteRepo,
                                EstimationService estimation,
                                GeometrySupport geo,
                                TitleGenerator titleGenerator,
                                DispatchEventBus bus) {
        this.repo = repo;
        this.vehicleRepo = vehicleRepo;
        this.mechanicRepo = mechanicRepo;
        this.clientRepo = clientRepo;
        this.vmrsRepo = vmrsRepo;
        this.siteRepo = siteRepo;
        this.estimation = estimation;
        this.geo = geo;
        this.titleGenerator = titleGenerator;
        this.bus = bus;
    }

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
        if (in.siteId() == null) throw new IllegalArgumentException("siteId required");
        Site site = siteRepo.findById(in.siteId());
        if (site == null) throw new IllegalArgumentException("siteId not found");

        ServiceOrder so = new ServiceOrder();
        so.vehicle = v;
        so.vmrsCode = c;
        so.site = site;

        Client resolvedClient;
        if (in.clientId() != null) {
            resolvedClient = clientRepo.findById(in.clientId());
            if (resolvedClient == null) throw new IllegalArgumentException("clientId not found");
        } else {
            resolvedClient = site.client;
        }
        so.client = resolvedClient;

        if (site.lat != null && site.lng != null) {
            so.siteLocation = geo.point(site.lng, site.lat);
        } else if (in.siteLocation() != null) {
            so.siteLocation = geo.point(in.siteLocation().lng(), in.siteLocation().lat());
        } else {
            throw new IllegalArgumentException("siteLocation required when site has no coordinates");
        }
        so.notes = in.notes();

        if (in.title() == null || in.title().isBlank()) {
            so.title = titleGenerator.generate(v, c);
        } else {
            String t = in.title().trim();
            if (t.length() > 120) throw new IllegalArgumentException("title must be <= 120 chars");
            so.title = t;
        }

        if (in.estimation() != null && !in.estimation().isBlank()) {
            try {
                so.estimatedMinutes = EstimationParser.parse(in.estimation());
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("estimation: " + ex.getMessage());
            }
            if (so.estimatedMinutes <= 0) {
                throw new IllegalArgumentException("estimation must be > 0 minutes");
            }
        } else {
            so.estimatedMinutes = estimation.estimateMinutes(c);
        }

        boolean wantsSchedule = in.mechanicId() != null
                && in.scheduledStartAt() != null
                && in.scheduledEndAt() != null;
        boolean partialSchedule = !wantsSchedule
                && (in.mechanicId() != null || in.scheduledStartAt() != null || in.scheduledEndAt() != null);
        if (partialSchedule) {
            throw new IllegalArgumentException("mechanicId, scheduledStartAt and scheduledEndAt must all be set together");
        }

        if (wantsSchedule) {
            Mechanic m = mechanicRepo.findById(in.mechanicId());
            if (m == null) throw new IllegalArgumentException("mechanicId not found");
            so.mechanic = m;
            so.scheduledStartAt = in.scheduledStartAt();
            so.scheduledEndAt = in.scheduledEndAt();
            // Set state to APPROVED first so the state-machine guard for SCHEDULED transition fires (enforces start<end etc.)
            so.state = ServiceOrderState.APPROVED;
            ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.SCHEDULED);
        } else {
            so.state = ServiceOrderState.REQUESTED;
        }

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
    @Path("/{id}/schedule")
    @Transactional
    public ServiceOrderDto schedule(@PathParam("id") UUID id, ScheduleRequest in) {
        if (in == null || in.mechanicId() == null
                || in.scheduledStartAt() == null || in.scheduledEndAt() == null) {
            throw new IllegalArgumentException("mechanicId, scheduledStartAt, scheduledEndAt all required");
        }
        Mechanic m = mechanicRepo.findById(in.mechanicId());
        if (m == null) throw new IllegalArgumentException("mechanicId not found");

        ServiceOrder so = load(id);
        so.mechanic = m;
        so.scheduledStartAt = in.scheduledStartAt();
        so.scheduledEndAt = in.scheduledEndAt();
        return applyTransition(so, ServiceOrderState.SCHEDULED);
    }

    @PATCH
    @Path("/{id}/schedule")
    @Transactional
    public ServiceOrderDto patchSchedule(@PathParam("id") UUID id, PatchScheduleRequest in) {
        if (in == null
                || (in.mechanicId() == null && in.scheduledStartAt() == null && in.scheduledEndAt() == null)) {
            throw new IllegalArgumentException("at least one of mechanicId, scheduledStartAt, scheduledEndAt required");
        }
        ServiceOrder so = load(id);
        if (so.state != ServiceOrderState.SCHEDULED) {
            throw new com.terrapulse.domain.service.IllegalStateTransitionException(
                    "PATCH /schedule only allowed in SCHEDULED state (got " + so.state + ")");
        }
        UUID previousMechanicId = so.mechanic != null ? so.mechanic.id : null;

        if (in.mechanicId() != null) {
            Mechanic m = mechanicRepo.findById(in.mechanicId());
            if (m == null) throw new IllegalArgumentException("mechanicId not found");
            so.mechanic = m;
        }
        java.time.Instant newStart = in.scheduledStartAt() != null ? in.scheduledStartAt() : so.scheduledStartAt;
        java.time.Instant newEnd   = in.scheduledEndAt()   != null ? in.scheduledEndAt()   : so.scheduledEndAt;
        if (newEnd == null || newStart == null || !newEnd.isAfter(newStart)) {
            throw new IllegalArgumentException("scheduledEndAt must be after scheduledStartAt");
        }
        so.scheduledStartAt = newStart;
        so.scheduledEndAt = newEnd;

        ServiceOrderDto dto = ServiceOrderDto.of(so);
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", so.id);
        payload.put("mechanicId", so.mechanic.id);
        payload.put("fromMechanicId", previousMechanicId);
        payload.put("scheduledStartAt", so.scheduledStartAt);
        payload.put("scheduledEndAt", so.scheduledEndAt);
        bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_SCHEDULE_CHANGED, payload));
        return dto;
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
    @Path("/{id}/reassign")
    @Transactional
    public ServiceOrderDto reassign(@PathParam("id") UUID id, DispatchRequest in) {
        if (in == null || in.mechanicId() == null) {
            throw new IllegalArgumentException("mechanicId required");
        }
        Mechanic m = mechanicRepo.findById(in.mechanicId());
        if (m == null) throw new IllegalArgumentException("mechanicId not found");
        ServiceOrder so = load(id);
        if (so.state != ServiceOrderState.DISPATCHED && so.state != ServiceOrderState.IN_PROGRESS) {
            throw new IllegalArgumentException("reassign only allowed in DISPATCHED or IN_PROGRESS (got " + so.state + ")");
        }
        UUID previous = so.mechanic != null ? so.mechanic.id : null;
        so.mechanic = m;
        ServiceOrderDto dto = ServiceOrderDto.of(so);
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", so.id);
        payload.put("fromState", so.state);
        payload.put("toState", so.state);
        payload.put("mechanicId", so.mechanic.id);
        payload.put("previousMechanicId", previous);
        payload.put("reassigned", true);
        bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_STATE_CHANGED, payload));
        return dto;
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
        ServiceOrder so = load(id);
        ServiceOrderState from = so.state;
        java.time.Instant now = java.time.Instant.now();

        String reason = (in.reason() == null || in.reason().isBlank()) ? "no reason given" : in.reason();
        String entry = "[override " + now + "] " + from + " -> " + target + ": " + reason;
        so.notes = (so.notes == null || so.notes.isBlank()) ? entry : so.notes + "\n" + entry;
        switch (target) {
            case REQUESTED, QUOTED, APPROVED -> {
                so.mechanic = null;
                so.dispatchedAt = null;
                so.startedAt = null;
                so.completedAt = null;
                so.actualMinutes = null;
            }
            case DISPATCHED -> {
                if (so.mechanic == null) {
                    if (in.mechanicId() == null) {
                        throw new IllegalArgumentException("mechanicId required to override to DISPATCHED");
                    }
                    so.mechanic = mechanicRepo.findById(in.mechanicId());
                    if (so.mechanic == null) {
                        throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
                    }
                }
                if (so.dispatchedAt == null) so.dispatchedAt = now;
                so.startedAt = null;
                so.completedAt = null;
                so.actualMinutes = null;
            }
            case IN_PROGRESS -> {
                if (so.mechanic == null) {
                    if (in.mechanicId() == null) {
                        throw new IllegalArgumentException("mechanicId required to override to IN_PROGRESS");
                    }
                    so.mechanic = mechanicRepo.findById(in.mechanicId());
                    if (so.mechanic == null) {
                        throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
                    }
                }
                if (so.dispatchedAt == null) so.dispatchedAt = now;
                if (so.startedAt == null) so.startedAt = now;
                so.completedAt = null;
                so.actualMinutes = null;
            }
            case COMPLETED -> {
                if (so.mechanic == null) {
                    if (in.mechanicId() == null) {
                        throw new IllegalArgumentException("mechanicId required to override to COMPLETED");
                    }
                    so.mechanic = mechanicRepo.findById(in.mechanicId());
                    if (so.mechanic == null) {
                        throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
                    }
                }
                if (so.dispatchedAt == null) so.dispatchedAt = now;
                if (so.startedAt == null) so.startedAt = now;
                if (so.actualMinutes == null) {
                    if (in.actualMinutes() == null || in.actualMinutes() < 1) {
                        throw new IllegalArgumentException("actualMinutes required to override to COMPLETED");
                    }
                    so.actualMinutes = in.actualMinutes();
                }
                if (so.completedAt == null) so.completedAt = now;
            }
            case CANCELLED -> {
                // keep lifecycle fields for audit trail
            }
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

    @PATCH
    @Path("/{id}/title")
    @Transactional
    public ServiceOrderDto renameTitle(@PathParam("id") UUID id, TitleUpdateDto in) {
        if (in == null || in.title() == null || in.title().isBlank()) {
            throw new IllegalArgumentException("title required");
        }
        String t = in.title().trim();
        if (t.length() > 120) {
            throw new IllegalArgumentException("title must be <= 120 chars");
        }
        ServiceOrder so = load(id);
        so.title = t;
        ServiceOrderDto dto = ServiceOrderDto.of(so);
        // No dedicated SERVICE_ORDER_UPDATED constant exists yet; reuse
        // SERVICE_ORDER_STATE_CHANGED with titleChanged=true so subscribers can
        // disambiguate. Payload shape stays additive.
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", so.id);
        payload.put("fromState", so.state);
        payload.put("toState", so.state);
        payload.put("title", so.title);
        payload.put("titleChanged", true);
        bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_STATE_CHANGED, payload));
        return dto;
    }

    private ServiceOrder load(UUID id) {
        ServiceOrder so = repo.findById(id);
        if (so == null) throw new NotFoundException();
        return so;
    }
}
