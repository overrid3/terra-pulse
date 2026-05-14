package com.terrapulse.repository;

import com.terrapulse.domain.mechanic.MechanicAbsence;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Parameters;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class MechanicAbsenceRepository implements PanacheRepositoryBase<MechanicAbsence, UUID> {

    public List<MechanicAbsence> findByMechanic(UUID mechanicId) {
        return list("mechanic.id = ?1 order by startAt desc", mechanicId);
    }

    public List<MechanicAbsence> findOverlapping(Instant from, Instant to) {
        return list("startAt < :to and endAt > :from order by startAt",
                Parameters.with("from", from).and("to", to));
    }
}
