package com.terrapulse.api.dto;

import com.terrapulse.domain.reservation.DryHireReservation;
import com.terrapulse.domain.reservation.HireType;
import com.terrapulse.domain.reservation.Reservation;
import com.terrapulse.domain.reservation.ReservationStatus;
import com.terrapulse.domain.reservation.WetHireReservation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class ReservationDtos {

    private ReservationDtos() {}

    public record ReservationDto(
            UUID id,
            UUID vehicleId,
            UUID clientId,
            String clientName,
            Instant startAt,
            Instant endAt,
            HireType hireType,
            ReservationStatus status,
            BigDecimal dailyRate,
            BigDecimal hourlyRate,
            UUID operatorMechanicId,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static ReservationDto of(Reservation r) {
            BigDecimal daily = null, hourly = null;
            UUID operatorId = null;
            if (r instanceof DryHireReservation d) {
                daily = d.dailyRate;
            } else if (r instanceof WetHireReservation w) {
                hourly = w.hourlyRate;
                operatorId = w.operatorMechanic != null ? w.operatorMechanic.id : null;
            }
            return new ReservationDto(r.id, r.vehicle.id, r.client.id, r.client.name,
                    r.startAt, r.endAt, r.hireType(), r.status,
                    daily, hourly, operatorId, r.createdAt, r.updatedAt);
        }
    }

    public record ReservationCreateDto(
            UUID vehicleId,
            UUID clientId,
            Instant startAt,
            Instant endAt,
            HireType hireType,
            BigDecimal dailyRate,
            BigDecimal hourlyRate,
            UUID operatorMechanicId
    ) {}

    public record ReservationPatchDto(
            ReservationStatus status
    ) {}
}
