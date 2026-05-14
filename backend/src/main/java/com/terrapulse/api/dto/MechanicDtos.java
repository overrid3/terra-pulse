package com.terrapulse.api.dto;

import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.domain.mechanic.MechanicStatus;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public final class MechanicDtos {

    private MechanicDtos() {}

    public record MechanicDto(
            UUID id,
            String fullName,
            String phone,
            List<String> skills,
            MechanicStatus status,
            LatLng location,
            Instant locationUpdatedAt,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static MechanicDto of(Mechanic m) {
            List<String> names = m.skills.stream()
                    .map(s -> s.name)
                    .sorted(Comparator.naturalOrder())
                    .toList();
            return new MechanicDto(m.id, m.fullName, m.phone, names, m.status,
                    LatLng.of(m.location), m.locationUpdatedAt, m.createdAt, m.updatedAt);
        }
    }

    public record MechanicCreateDto(
            String fullName,
            String phone,
            List<String> skills,
            MechanicStatus status,
            LatLng location
    ) {}

    public record MechanicPatchDto(
            String fullName,
            String phone,
            List<String> skills,
            MechanicStatus status,
            LatLng location
    ) {}
}
