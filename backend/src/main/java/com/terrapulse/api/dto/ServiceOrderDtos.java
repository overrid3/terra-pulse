package com.terrapulse.api.dto;

import com.terrapulse.domain.service.ServiceOrder;
import com.terrapulse.domain.service.ServiceOrderState;

import java.time.Instant;
import java.util.UUID;

public final class ServiceOrderDtos {

    private ServiceOrderDtos() {}

    public record ServiceOrderDto(
            UUID id,
            UUID vehicleId,
            UUID mechanicId,
            UUID clientId,
            String clientName,
            String vmrsCode,
            String vmrsDescription,
            ServiceOrderState state,
            Integer estimatedMinutes,
            Integer actualMinutes,
            LatLng siteLocation,
            Instant requestedAt,
            Instant dispatchedAt,
            Instant startedAt,
            Instant completedAt,
            String notes,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static ServiceOrderDto of(ServiceOrder so) {
            return new ServiceOrderDto(
                    so.id,
                    so.vehicle.id,
                    so.mechanic != null ? so.mechanic.id : null,
                    so.client != null ? so.client.id : null,
                    so.client != null ? so.client.name : null,
                    so.vmrsCode.code,
                    so.vmrsCode.description,
                    so.state,
                    so.estimatedMinutes,
                    so.actualMinutes,
                    LatLng.of(so.siteLocation),
                    so.requestedAt,
                    so.dispatchedAt,
                    so.startedAt,
                    so.completedAt,
                    so.notes,
                    so.createdAt,
                    so.updatedAt
            );
        }
    }

    public record ServiceOrderCreateDto(
            UUID vehicleId,
            UUID clientId,
            String vmrsCode,
            LatLng siteLocation,
            String notes
    ) {}

    public record DispatchRequest(UUID mechanicId) {}

    public record CompleteRequest(Integer actualMinutes) {}

    public record SimulateMoveRequest(UUID mechanicId, double lat, double lng) {}

    public record OverrideStateRequest(ServiceOrderState state, String reason) {}
}
