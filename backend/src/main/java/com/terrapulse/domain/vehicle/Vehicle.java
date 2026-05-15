package com.terrapulse.domain.vehicle;

import com.terrapulse.domain.site.Site;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "vehicle")
public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    public UUID id;

    @Column(name = "make", nullable = false, length = 64)
    public String make;

    @Column(name = "model", nullable = false, length = 64)
    public String model;

    @Column(name = "serial_number", nullable = false, unique = true, length = 64)
    public String serialNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "vehicle_class", nullable = false, length = 32)
    public VehicleClass vehicleClass;

    @Column(name = "engine_hours", nullable = false, precision = 10, scale = 2)
    public BigDecimal engineHours = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    public VehicleStatus status = VehicleStatus.AVAILABLE;

    @ManyToOne
    @JoinColumn(name = "site_id")
    public Site site;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;
}
