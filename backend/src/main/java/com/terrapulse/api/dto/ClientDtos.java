package com.terrapulse.api.dto;

import com.terrapulse.domain.client.Client;

import java.time.Instant;
import java.util.UUID;

public final class ClientDtos {

    private ClientDtos() {}

    public record ClientDto(
            UUID id,
            String name,
            String email,
            String phone,
            String vatNumber,
            String addressLine1,
            String addressLine2,
            String city,
            String postalCode,
            String country,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static ClientDto of(Client c) {
            return new ClientDto(c.id, c.name, c.email, c.phone, c.vatNumber,
                    c.addressLine1, c.addressLine2, c.city, c.postalCode, c.country,
                    c.createdAt, c.updatedAt);
        }
    }

    public record ClientUpsertDto(
            String name,
            String email,
            String phone,
            String vatNumber,
            String addressLine1,
            String addressLine2,
            String city,
            String postalCode,
            String country
    ) {}

    public record ClientSummaryDto(
            UUID id,
            String name,
            String email,
            String phone,
            String vatNumber,
            String addressLine1,
            String addressLine2,
            String city,
            String postalCode,
            String country,
            long siteCount,
            long openOrderCount,
            java.time.Instant createdAt,
            java.time.Instant updatedAt
    ) {}
}
