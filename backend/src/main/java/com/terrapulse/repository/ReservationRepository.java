package com.terrapulse.repository;

import com.terrapulse.domain.reservation.Reservation;
import io.quarkus.hibernate.reactive.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Parameters;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class ReservationRepository implements PanacheRepositoryBase<Reservation, UUID> {

    public Uni<List<Reservation>> findOverlapping(UUID vehicleId, Instant from, Instant to) {
        return list("vehicle.id = :vid and startAt < :to and endAt > :from and status <> 'CANCELLED'",
                Parameters.with("vid", vehicleId).and("from", from).and("to", to));
    }

    public Uni<List<Reservation>> filter(UUID vehicleIdOrNull, Instant fromOrNull, Instant toOrNull) {
        if (vehicleIdOrNull == null && fromOrNull == null && toOrNull == null) {
            return listAll();
        }
        StringBuilder jpql = new StringBuilder("1=1");
        Parameters params = new Parameters();
        if (vehicleIdOrNull != null) {
            jpql.append(" and vehicle.id = :vid");
            params.and("vid", vehicleIdOrNull);
        }
        if (fromOrNull != null) {
            jpql.append(" and endAt > :from");
            params.and("from", fromOrNull);
        }
        if (toOrNull != null) {
            jpql.append(" and startAt < :to");
            params.and("to", toOrNull);
        }
        return list(jpql.toString(), params);
    }
}
