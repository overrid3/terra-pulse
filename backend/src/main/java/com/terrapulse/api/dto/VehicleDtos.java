package com.terrapulse.api.dto;

import com.terrapulse.domain.vehicle.Vehicle;
import com.terrapulse.domain.vehicle.VehicleClass;
import com.terrapulse.domain.vehicle.VehicleStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class VehicleDtos {

    private VehicleDtos() {}

    public record VehicleDto(
            UUID id,
            String make,
            String model,
            String serialNumber,
            VehicleClass vehicleClass,
            BigDecimal engineHours,
            VehicleStatus status,
            Instant createdAt,
            Instant updatedAt,
            UUID siteId
    ) {
        public static VehicleDto of(Vehicle v) {
            return new VehicleDto(v.id, v.make, v.model, v.serialNumber, v.vehicleClass,
                    v.engineHours, v.status, v.createdAt, v.updatedAt,
                    v.site != null ? v.site.id : null);
        }
    }

    public record VehicleCreateDto(
            String make,
            String model,
            String serialNumber,
            VehicleClass vehicleClass,
            BigDecimal engineHours,
            VehicleStatus status
    ) {}

    public record VehiclePatchDto(
            BigDecimal engineHours,
            VehicleStatus status,
            UUID siteId
    ) {}

    public record VehicleUpdateDto(
            String make,
            String model,
            String serialNumber,
            VehicleClass vehicleClass,
            BigDecimal engineHours,
            VehicleStatus status
    ) {}
}
