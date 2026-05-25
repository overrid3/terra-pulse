package com.terrapulse.api;

import com.terrapulse.api.dto.ServiceOrderDtos.CompleteRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.OverrideStateRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.PatchScheduleRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.ScheduleRequest;
import com.terrapulse.api.dto.ServiceOrderDtos.ServiceOrderCreateDto;
import com.terrapulse.api.dto.ServiceOrderDtos.ServiceOrderDto;
import com.terrapulse.api.dto.ServiceOrderDtos.ServiceOrderPatchDto;
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
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jspecify.annotations.NonNull;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

@Path("/api/service-orders")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
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

    // ── READ ─────────────────────────────────────────────────────────────────

    @GET
    public Uni<List<ServiceOrderDto>> list(@QueryParam("state") ServiceOrderState state,
                                           @QueryParam("mechanicId") UUID mechanicId,
                                           @QueryParam("vehicleId") UUID vehicleId) {
        return repo.filter(state, mechanicId, vehicleId)
                .map(list -> list.stream().map(ServiceOrderDto::of).toList());
    }

    @GET
    @Path("/{id}")
    public Uni<ServiceOrderDto> get(@PathParam("id") UUID id) {
        return load(id).map(ServiceOrderDto::of);
    }

    // ── CREATE ────────────────────────────────────────────────────────────────

    @POST
    @WithTransaction
    public Uni<Response> create(ServiceOrderCreateDto in) {
        if (in.siteId() == null) throw new IllegalArgumentException("siteId required");

        boolean wantsSchedule = in.mechanicId() != null
                && in.scheduledStartAt() != null
                && in.scheduledEndAt() != null;
        boolean partialSchedule = !wantsSchedule
                && (in.mechanicId() != null || in.scheduledStartAt() != null || in.scheduledEndAt() != null);
        if (partialSchedule) {
            throw new IllegalArgumentException(
                    "mechanicId, scheduledStartAt and scheduledEndAt must all be set together");
        }

        return loadRequiredFks(in.vehicleId(), in.vmrsCode(), in.siteId())
                .flatMap(fk -> {
                    Uni<Client> clientUni = in.clientId() != null
                            ? clientRepo.findById(in.clientId()).map(cl -> {
                        if (cl == null) throw new IllegalArgumentException("clientId not found");
                        return cl;
                    })
                            : Uni.createFrom().item(fk.site.client);

                    return clientUni.flatMap(client -> {
                        ServiceOrder so = new ServiceOrder();
                        so.vehicle = fk.vehicle;
                        so.vmrsCode = fk.vmrs;
                        so.site = fk.site;
                        so.client = client;

                        if (fk.site.lat != null && fk.site.lng != null) {
                            so.siteLocation = geo.point(fk.site.lng, fk.site.lat);
                        } else if (in.siteLocation() != null) {
                            so.siteLocation = geo.point(in.siteLocation().lng(), in.siteLocation().lat());
                        }
                        so.notes = in.notes();

                        if (in.title() == null || in.title().isBlank()) {
                            so.title = titleGenerator.generate(fk.vehicle, fk.vmrs);
                        } else {
                            String t2 = in.title().trim();
                            if (t2.length() > 120) throw new IllegalArgumentException("title must be <= 120 chars");
                            so.title = t2;
                        }

                        if (in.estimation() != null && !in.estimation().isBlank()) {
                            try {
                                so.estimatedMinutes = EstimationParser.parse(in.estimation());
                            } catch (IllegalArgumentException ex) {
                                throw new IllegalArgumentException("estimation: " + ex.getMessage());
                            }
                            if (so.estimatedMinutes <= 0)
                                throw new IllegalArgumentException("estimation must be > 0 minutes");
                        } else {
                            so.estimatedMinutes = estimation.estimateMinutes(fk.vmrs);
                        }

                        if (wantsSchedule) {
                            return mechanicRepo.findById(in.mechanicId()).flatMap(m -> {
                                if (m == null) throw new IllegalArgumentException("mechanicId not found");
                                so.mechanic = m;
                                so.scheduledStartAt = in.scheduledStartAt();
                                so.scheduledEndAt = in.scheduledEndAt();
                                so.state = ServiceOrderState.APPROVED;
                                ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.SCHEDULED);
                                return repo.persist(so).map(ignored -> {
                                    ServiceOrderDto dto = ServiceOrderDto.of(so);
                                    bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_CREATED, dto));
                                    return Response.status(Response.Status.CREATED).entity(dto).build();
                                });
                            });
                        }
                        so.state = ServiceOrderState.REQUESTED;
                        return repo.persist(so).map(ignored -> {
                            ServiceOrderDto dto = ServiceOrderDto.of(so);
                            bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_CREATED, dto));
                            return Response.status(Response.Status.CREATED).entity(dto).build();
                        });
                    });
                });
    }

    // ── TRANSITIONS ───────────────────────────────────────────────────────────

    @POST
    @Path("/{id}/quote")
    @WithTransaction
    public Uni<ServiceOrderDto> quote(@PathParam("id") UUID id) {
        return load(id).flatMap(so -> {
            so.estimatedMinutes = estimation.estimateMinutes(so.vmrsCode);
            return applyTransition(so, ServiceOrderState.QUOTED);
        });
    }

    @POST
    @Path("/{id}/approve")
    @WithTransaction
    public Uni<ServiceOrderDto> approve(@PathParam("id") UUID id) {
        return load(id).flatMap(so -> applyTransition(so, ServiceOrderState.APPROVED));
    }

    @POST
    @Path("/{id}/schedule")
    @WithTransaction
    public Uni<ServiceOrderDto> schedule(@PathParam("id") UUID id, ScheduleRequest in) {
        if (in == null || in.mechanicId() == null
                || in.scheduledStartAt() == null || in.scheduledEndAt() == null) {
            throw new IllegalArgumentException("mechanicId, scheduledStartAt, scheduledEndAt all required");
        }
        return load(id).flatMap(so ->
                mechanicRepo.findById(in.mechanicId()).flatMap(m -> {
                    if (m == null) throw new IllegalArgumentException("mechanicId not found");
                    so.mechanic = m;
                    so.scheduledStartAt = in.scheduledStartAt();
                    so.scheduledEndAt = in.scheduledEndAt();
                    return applyTransition(so, ServiceOrderState.SCHEDULED);
                })
        );
    }

    @PATCH
    @Path("/{id}/schedule")
    @WithTransaction
    public Uni<ServiceOrderDto> patchSchedule(@PathParam("id") UUID id, PatchScheduleRequest in) {
        if (in == null
                || (in.mechanicId() == null && in.scheduledStartAt() == null && in.scheduledEndAt() == null)) {
            throw new IllegalArgumentException(
                    "at least one of mechanicId, scheduledStartAt, scheduledEndAt required");
        }
        return load(id).flatMap(so -> {
            if (so.state != ServiceOrderState.SCHEDULED) {
                throw new com.terrapulse.domain.service.IllegalStateTransitionException(
                        "PATCH /schedule only allowed in SCHEDULED state (got " + so.state + ")");
            }
            UUID previousMechanicId = so.mechanic != null ? so.mechanic.id : null;

            if (in.mechanicId() != null) {
                return mechanicRepo.findById(in.mechanicId()).map(m -> {
                    if (m == null) throw new IllegalArgumentException("mechanicId not found");
                    so.mechanic = m;
                    applyScheduleTimes(so, in);
                    publishRescheduleEvent(so, previousMechanicId);
                    return ServiceOrderDto.of(so);
                });
            }
            applyScheduleTimes(so, in);
            publishRescheduleEvent(so, previousMechanicId);
            return Uni.createFrom().item(ServiceOrderDto.of(so));
        });
    }

    @POST
    @Path("/{id}/start")
    @WithTransaction
    public Uni<ServiceOrderDto> start(@PathParam("id") UUID id) {
        return load(id).flatMap(so -> applyTransition(so, ServiceOrderState.IN_PROGRESS));
    }

    @POST
    @Path("/{id}/complete")
    @WithTransaction
    public Uni<ServiceOrderDto> complete(@PathParam("id") UUID id, CompleteRequest in) {
        if (in == null || in.actualMinutes() == null) {
            throw new IllegalArgumentException("actualMinutes required");
        }
        return load(id).flatMap(so -> {
            so.actualMinutes = in.actualMinutes();
            return applyTransition(so, ServiceOrderState.COMPLETED);
        });
    }

    @POST
    @Path("/{id}/cancel")
    @WithTransaction
    public Uni<ServiceOrderDto> cancel(@PathParam("id") UUID id) {
        return load(id).flatMap(so -> applyTransition(so, ServiceOrderState.CANCELLED));
    }

    @POST
    @Path("/{id}/unassign")
    @WithTransaction
    public Uni<ServiceOrderDto> unassign(@PathParam("id") UUID id) {
        return load(id).map(so -> {
            if (so.state != ServiceOrderState.SCHEDULED) {
                throw new com.terrapulse.domain.service.IllegalStateTransitionException(
                        "unassign only allowed in SCHEDULED state (got " + so.state + ")");
            }
            UUID previousMechanicId = so.mechanic != null ? so.mechanic.id : null;
            so.mechanic = null;
            so.scheduledStartAt = null;
            so.scheduledEndAt = null;
            so.dispatchedAt = null;
            so.state = ServiceOrderState.APPROVED;

            ServiceOrderDto dto = ServiceOrderDto.of(so);
            Map<String, Object> payload = new HashMap<>();
            payload.put("id", so.id);
            payload.put("fromState", ServiceOrderState.SCHEDULED);
            payload.put("toState", ServiceOrderState.APPROVED);
            payload.put("fromMechanicId", previousMechanicId);
            payload.put("mechanicId", null);
            payload.put("unassigned", true);
            bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_STATE_CHANGED, payload));
            return dto;
        });
    }

    // ── OVERRIDE STATE ────────────────────────────────────────────────────────

    @POST
    @Path("/{id}/override-state")
    @WithTransaction
    public Uni<ServiceOrderDto> overrideState(@PathParam("id") UUID id, OverrideStateRequest in) {
        if (in == null || in.state() == null) throw new IllegalArgumentException("state required");

        return load(id).flatMap(so -> {
            ServiceOrderState target = in.state();
            ServiceOrderState from = so.state;
            Instant now = Instant.now();
            String reason = (in.reason() == null || in.reason().isBlank()) ? "no reason given" : in.reason();
            String entry = "[override " + now + "] " + from + " -> " + target + ": " + reason;
            so.notes = (so.notes == null || so.notes.isBlank()) ? entry : so.notes + "\n" + entry;

            return switch (target) {
                case REQUESTED, QUOTED, APPROVED -> {
                    so.mechanic = null;
                    so.scheduledStartAt = null;
                    so.scheduledEndAt = null;
                    so.dispatchedAt = null;
                    so.startedAt = null;
                    so.completedAt = null;
                    so.actualMinutes = null;
                    so.state = target;
                    publishOverrideEvent(so, from, target, reason);
                    yield Uni.createFrom().item(ServiceOrderDto.of(so));
                }
                case SCHEDULED -> {
                    if (so.mechanic == null && in.mechanicId() == null)
                        throw new IllegalArgumentException("mechanicId required to override to SCHEDULED");
                    Instant newStart = in.scheduledStartAt() != null ? in.scheduledStartAt() : so.scheduledStartAt;
                    Instant newEnd   = in.scheduledEndAt()   != null ? in.scheduledEndAt()   : so.scheduledEndAt;
                    if (newStart == null || newEnd == null || !newEnd.isAfter(newStart))
                        throw new IllegalArgumentException(
                                "scheduledStartAt + scheduledEndAt required (end after start) to override to SCHEDULED");
                    so.scheduledStartAt = newStart;
                    so.scheduledEndAt = newEnd;
                    so.startedAt = null;
                    so.completedAt = null;
                    so.actualMinutes = null;
                    so.state = target;
                    if (so.mechanic != null) {
                        publishOverrideEvent(so, from, target, reason);
                        yield Uni.createFrom().item(ServiceOrderDto.of(so));
                    }
                    yield mechanicRepo.findById(in.mechanicId()).map(m -> {
                        if (m == null) throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
                        so.mechanic = m;
                        publishOverrideEvent(so, from, target, reason);
                        return ServiceOrderDto.of(so);
                    });
                }
                case IN_PROGRESS -> {
                    if (so.scheduledStartAt == null) so.scheduledStartAt = in.scheduledStartAt() != null ? in.scheduledStartAt() : now;
                    if (so.scheduledEndAt == null)   so.scheduledEndAt   = in.scheduledEndAt()   != null ? in.scheduledEndAt()   : so.scheduledStartAt.plusSeconds(60L * Math.max(1, so.estimatedMinutes));
                    if (so.startedAt == null) so.startedAt = now;
                    so.completedAt = null;
                    so.actualMinutes = null;
                    so.state = target;
                    if (so.mechanic != null) {
                        publishOverrideEvent(so, from, target, reason);
                        yield Uni.createFrom().item(ServiceOrderDto.of(so));
                    }
                    if (in.mechanicId() == null) throw new IllegalArgumentException("mechanicId required to override to IN_PROGRESS");
                    yield mechanicRepo.findById(in.mechanicId()).map(m -> {
                        if (m == null) throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
                        so.mechanic = m;
                        publishOverrideEvent(so, from, target, reason);
                        return ServiceOrderDto.of(so);
                    });
                }
                case COMPLETED -> {
                    if (so.scheduledStartAt == null) so.scheduledStartAt = in.scheduledStartAt() != null ? in.scheduledStartAt() : now;
                    if (so.scheduledEndAt == null)   so.scheduledEndAt   = in.scheduledEndAt()   != null ? in.scheduledEndAt()   : so.scheduledStartAt.plusSeconds(60L * Math.max(1, so.estimatedMinutes));
                    if (so.startedAt == null) so.startedAt = now;
                    if (so.actualMinutes == null) {
                        if (in.actualMinutes() == null || in.actualMinutes() < 1)
                            throw new IllegalArgumentException("actualMinutes required to override to COMPLETED");
                        so.actualMinutes = in.actualMinutes();
                    }
                    if (so.completedAt == null) so.completedAt = now;
                    so.state = target;
                    if (so.mechanic != null) {
                        publishOverrideEvent(so, from, target, reason);
                        yield Uni.createFrom().item(ServiceOrderDto.of(so));
                    }
                    if (in.mechanicId() == null) throw new IllegalArgumentException("mechanicId required to override to COMPLETED");
                    yield mechanicRepo.findById(in.mechanicId()).map(m -> {
                        if (m == null) throw new IllegalArgumentException("mechanic not found: " + in.mechanicId());
                        so.mechanic = m;
                        publishOverrideEvent(so, from, target, reason);
                        return ServiceOrderDto.of(so);
                    });
                }
                case CANCELLED -> {
                    so.state = target;
                    publishOverrideEvent(so, from, target, reason);
                    yield Uni.createFrom().item(ServiceOrderDto.of(so));
                }
            };
        });
    }

    // ── PATCH ─────────────────────────────────────────────────────────────────

    @PATCH
    @Path("/{id}")
    @WithTransaction
    public Uni<ServiceOrderDto> patch(@PathParam("id") UUID id, ServiceOrderPatchDto in) {
        if (in == null) throw new IllegalArgumentException("body required");
        return load(id).flatMap(so -> {
            if (in.title() != null) {
                String t = in.title().trim();
                if (t.isEmpty()) throw new IllegalArgumentException("title cannot be empty");
                if (t.length() > 120) throw new IllegalArgumentException("title must be <= 120 chars");
                so.title = t;
            }
            if (in.notes() != null) so.notes = in.notes();
            if (in.estimatedMinutes() != null) {
                if (in.estimatedMinutes() <= 0)
                    throw new IllegalArgumentException("estimatedMinutes must be > 0");
                so.estimatedMinutes = in.estimatedMinutes();
            }
            if (in.scheduledStartAt() != null) so.scheduledStartAt = in.scheduledStartAt();
            if (in.scheduledEndAt() != null)   so.scheduledEndAt   = in.scheduledEndAt();
            if (so.scheduledStartAt != null && so.scheduledEndAt != null
                    && !so.scheduledEndAt.isAfter(so.scheduledStartAt)) {
                throw new IllegalArgumentException("scheduledEndAt must be after scheduledStartAt");
            }

            return applyPatchFks(so, in).map(s -> {
                ServiceOrderDto dto = ServiceOrderDto.of(s);
                Map<String, Object> payload = new HashMap<>();
                payload.put("id", s.id);
                payload.put("order", dto);
                bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_UPDATED, payload));
                return dto;
            });
        });
    }

    @PATCH
    @Path("/{id}/title")
    @WithTransaction
    public Uni<ServiceOrderDto> renameTitle(@PathParam("id") UUID id, TitleUpdateDto in) {
        if (in == null || in.title() == null || in.title().isBlank()) {
            throw new IllegalArgumentException("title required");
        }
        String t = in.title().trim();
        if (t.length() > 120) throw new IllegalArgumentException("title must be <= 120 chars");
        return load(id).map(so -> {
            so.title = t;
            ServiceOrderDto dto = ServiceOrderDto.of(so);
            Map<String, Object> payload = new HashMap<>();
            payload.put("id", so.id);
            payload.put("fromState", so.state);
            payload.put("toState", so.state);
            payload.put("title", so.title);
            payload.put("titleChanged", true);
            bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_STATE_CHANGED, payload));
            return dto;
        });
    }

    @DELETE
    @Path("/{id}")
    @WithTransaction
    public Uni<Response> delete(@PathParam("id") UUID id) {
        return load(id).flatMap(so -> {
            if (so.state == ServiceOrderState.IN_PROGRESS) {
                throw new com.terrapulse.domain.service.IllegalStateTransitionException(
                        "cannot hard-delete IN_PROGRESS order; cancel or complete first");
            }
            UUID deletedId = so.id;
            UUID mechanicId = so.mechanic != null ? so.mechanic.id : null;
            return repo.delete(so).map(ignored -> {
                Map<String, Object> payload = new HashMap<>();
                payload.put("id", deletedId);
                payload.put("mechanicId", mechanicId);
                bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_DELETED, payload));
                return Response.noContent().build();
            });
        });
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

    private Uni<ServiceOrderDto> applyTransition(ServiceOrder so, ServiceOrderState target) {
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
        return Uni.createFrom().item(dto);
    }

    private void applyScheduleTimes(ServiceOrder so, PatchScheduleRequest in) {
        Instant newStart = in.scheduledStartAt() != null ? in.scheduledStartAt() : so.scheduledStartAt;
        Instant newEnd   = in.scheduledEndAt()   != null ? in.scheduledEndAt()   : so.scheduledEndAt;
        if (newEnd == null || newStart == null || !newEnd.isAfter(newStart)) {
            throw new IllegalArgumentException("scheduledEndAt must be after scheduledStartAt");
        }
        so.scheduledStartAt = newStart;
        so.scheduledEndAt = newEnd;
    }

    private void publishRescheduleEvent(ServiceOrder so, UUID previousMechanicId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", so.id);
        payload.put("mechanicId", so.mechanic.id);
        payload.put("fromMechanicId", previousMechanicId);
        payload.put("scheduledStartAt", so.scheduledStartAt);
        payload.put("scheduledEndAt", so.scheduledEndAt);
        bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_SCHEDULE_CHANGED, payload));
    }

    private void publishOverrideEvent(ServiceOrder so, ServiceOrderState from,
                                      ServiceOrderState target, String reason) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", so.id);
        payload.put("fromState", from);
        payload.put("toState", target);
        payload.put("override", true);
        payload.put("reason", reason);
        bus.publish(DispatchEvent.of(DispatchEvent.SERVICE_ORDER_STATE_CHANGED, payload));
    }

    private Uni<ServiceOrder> load(UUID id) {
        return repo.findById(id).map(so -> {
            if (so == null) throw new NotFoundException();
            return so;
        });
    }

    // ── FK HELPERS ────────────────────────────────────────────────────────────

    private record RequiredFks(Vehicle vehicle, VmrsCode vmrs, Site site) {
    }

    private Uni<RequiredFks> loadRequiredFks(UUID vehicleId, String vmrsCode, UUID siteId) {
        return vehicleRepo.findById(vehicleId).flatMap(v -> {
            if (v == null) throw new IllegalArgumentException("vehicleId not found");
            return vmrsRepo.findById(vmrsCode).flatMap(c -> {
                if (c == null) throw new IllegalArgumentException("vmrsCode not found");
                return siteRepo.findById(siteId).map(s -> {
                    if (s == null) throw new IllegalArgumentException("siteId not found");
                    return new RequiredFks(v, c, s);
                });
            });
        });
    }

    private Uni<RequiredFks> loadRequiredFks2(UUID vehicleId, String vmrsCode, UUID siteId) {

        var vehicleUni = vehicleRepo.findById(vehicleId);
        var vmrsCodeUni = vmrsRepo.findById(vmrsCode);
        var siteUni = siteRepo.findById(siteId);

        return vehicleUni.flatMap(v -> {
            if (v == null) throw new IllegalArgumentException("vehicleId not found");
            return vmrsCodeUni.flatMap(c -> {
                if (c == null) throw new IllegalArgumentException("vmrsCode not found");
                return siteUni.map(s -> {
                    if (s == null) throw new IllegalArgumentException("siteId not found");
                    return new RequiredFks(v, c, s);
                });
            });
        });
    }

    private Uni<ServiceOrder> applyPatchFks(ServiceOrder so, ServiceOrderPatchDto in) {
        Uni<ServiceOrder> chain = Uni.createFrom().item(so);
        if (in.vehicleId() != null)
            chain = chain.flatMap(s -> vehicleRepo.findById(in.vehicleId()).map(v -> {
                if (v == null) throw new IllegalArgumentException("vehicleId not found");
                s.vehicle = v;
                return s;
            }));
        if (in.clientId() != null)
            chain = chain.flatMap(s -> clientRepo.findById(in.clientId()).map(cl -> {
                if (cl == null) throw new IllegalArgumentException("clientId not found");
                s.client = cl;
                return s;
            }));
        if (in.siteId() != null)
            chain = chain.flatMap(s -> siteRepo.findById(in.siteId()).map(site -> {
                if (site == null) throw new IllegalArgumentException("siteId not found");
                s.site = site;
                s.siteLocation = (site.lat != null && site.lng != null)
                        ? geo.point(site.lng, site.lat) : null;
                return s;
            }));
        if (in.vmrsCode() != null)
            chain = chain.flatMap(s -> vmrsRepo.findById(in.vmrsCode()).map(vc -> {
                if (vc == null) throw new IllegalArgumentException("vmrsCode not found");
                s.vmrsCode = vc;
                return s;
            }));
        return chain;
    }

    private static @NonNull Supplier<IllegalArgumentException> argException(String message) {
        return () -> new IllegalArgumentException(message);
    }
}
