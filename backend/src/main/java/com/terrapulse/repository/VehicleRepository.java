package com.terrapulse.repository;

import com.terrapulse.domain.vehicle.Vehicle;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.UUID;

@ApplicationScoped
public class VehicleRepository implements PanacheRepositoryBase<Vehicle, UUID> {
}
