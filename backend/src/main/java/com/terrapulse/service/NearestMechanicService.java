package com.terrapulse.service;

import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.repository.MechanicAbsenceRepository;
import com.terrapulse.repository.MechanicRepository;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class NearestMechanicService {

    MechanicRepository mechanicRepository;
    MechanicAbsenceRepository absenceRepo;

    public NearestMechanicService(MechanicRepository mechanicRepository, MechanicAbsenceRepository absenceRepo) {
        this.mechanicRepository = mechanicRepository;
        this.absenceRepo = absenceRepo;
    }

    public Uni<List<Mechanic>> findNearest(double lat, double lng, int limit, String skillOrNull) {
        int safeLimit = Math.clamp(limit, 1, 50);
        Instant now = Instant.now();

        return mechanicRepository.findNearest(lat, lng, safeLimit * 3, skillOrNull)
                .flatMap(candidates -> absenceRepo.findOverlapping(now, now)
                        .map(absences -> {
                            Set<UUID> onAbsence = absences.stream()
                                    .map(a -> a.mechanic.id)
                                    .collect(Collectors.toSet());
                            return candidates.stream()
                                    .filter(m -> !onAbsence.contains(m.id))
                                    .limit(safeLimit)
                                    .toList();
                        }));
    }
}
