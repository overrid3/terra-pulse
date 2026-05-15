package com.terrapulse.domain.service;

import com.terrapulse.domain.client.Client;
import com.terrapulse.domain.mechanic.Mechanic;
import com.terrapulse.domain.site.Site;
import com.terrapulse.domain.vehicle.Vehicle;
import com.terrapulse.domain.vmrs.VmrsCode;
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
import org.locationtech.jts.geom.Point;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "service_order")
public class ServiceOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    public UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "vehicle_id", nullable = false)
    public Vehicle vehicle;

    @ManyToOne
    @JoinColumn(name = "mechanic_id")
    public Mechanic mechanic;

    @ManyToOne
    @JoinColumn(name = "client_id")
    public Client client;

    @ManyToOne(optional = false)
    @JoinColumn(name = "site_id", nullable = false)
    public Site site;

    @ManyToOne(optional = false)
    @JoinColumn(name = "vmrs_code", nullable = false)
    public VmrsCode vmrsCode;

    @Column(name = "title", nullable = false, length = 120)
    public String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 16)
    public ServiceOrderState state = ServiceOrderState.REQUESTED;

    @Column(name = "estimated_minutes", nullable = false)
    public Integer estimatedMinutes;

    @Column(name = "actual_minutes")
    public Integer actualMinutes;

    @Column(name = "site_location", nullable = false, columnDefinition = "geometry(Point,4326)")
    public Point siteLocation;

    @Column(name = "requested_at", nullable = false)
    public Instant requestedAt = Instant.now();

    @Column(name = "dispatched_at")
    public Instant dispatchedAt;

    @Column(name = "started_at")
    public Instant startedAt;

    @Column(name = "completed_at")
    public Instant completedAt;

    @Column(name = "notes", columnDefinition = "text")
    public String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;
}
