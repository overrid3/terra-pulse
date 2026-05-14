package com.terrapulse.service;

import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.repository.MechanicRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.util.List;

@ApplicationScoped
public class NearestMechanicService {

    @Inject
    MechanicRepository mechanicRepository;

    public List<Mechanic> findNearest(double lat, double lng, int limit, String skillOrNull) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        return mechanicRepository.findNearest(lat, lng, safeLimit, skillOrNull);
    }
}
