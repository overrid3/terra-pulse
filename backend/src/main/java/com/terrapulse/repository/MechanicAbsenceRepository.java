package com.terrapulse.repository;

import com.terrapulse.domain.mechanic.MechanicAbsence;
import io.quarkus.hibernate.reactive.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Parameters;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class MechanicAbsenceRepository implements PanacheRepositoryBase<MechanicAbsence, UUID> {

    public Uni<List<MechanicAbsence>> findByMechanic(UUID mechanicId) {
        return list("mechanic.id = ?1 order by startAt desc", mechanicId);
    }

    public Uni<List<MechanicAbsence>> findOverlapping(Instant from, Instant to) {
        return list("startAt < :to and endAt > :from order by startAt",
                Parameters.with("from", from).and("to", to));
    }
}
