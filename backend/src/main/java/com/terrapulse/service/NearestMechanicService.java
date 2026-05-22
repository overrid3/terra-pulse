package com.terrapulse.service;

import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.repository.MechanicAbsenceRepository;
import com.terrapulse.repository.MechanicRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class NearestMechanicService {

    @Inject
    MechanicRepository mechanicRepository;

    @Inject
    MechanicAbsenceRepository absenceRepo;

    public List<Mechanic> findNearest(double lat, double lng, int limit, String skillOrNull) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        
        // We fetch more than requested to account for mechanics on absence.
        // PostGIS KNN is fast; 3x limit is a safe heuristic for the POC.
        List<Mechanic> candidates = mechanicRepository.findNearest(lat, lng, safeLimit * 3, skillOrNull);
        
        Set<UUID> onAbsence = mechanicsOnAbsenceNow();
        
        return candidates.stream()
                .filter(m -> !onAbsence.contains(m.id))
                .limit(safeLimit)
                .toList();
    }

    private Set<UUID> mechanicsOnAbsenceNow() {
        Instant now = Instant.now();
        return absenceRepo.findOverlapping(now, now).stream()
                .map(a -> a.mechanic.id)
                .collect(Collectors.toSet());
    }
}
