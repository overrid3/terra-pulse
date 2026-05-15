package com.terrapulse.api.dto;

import com.terrapulse.domain.site.Site;
import java.time.Instant;
import java.util.UUID;

public final class SiteDtos {

    private SiteDtos() {}

    public record SiteDto(
            UUID id,
            UUID clientId,
            String name,
            Double lat,
            Double lng,
            String locationLabel,
            long openOrderCount,
            long equipmentCount,
            long personnelCount,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record SiteUpsertDto(
            String name,
            Double lat,
            Double lng,
            String locationLabel
    ) {}
}
