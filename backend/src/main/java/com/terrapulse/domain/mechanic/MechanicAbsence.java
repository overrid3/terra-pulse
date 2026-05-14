package com.terrapulse.domain.mechanic;

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

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mechanic_absence")
public class MechanicAbsence {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    public UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "mechanic_id", nullable = false)
    public Mechanic mechanic;

    @Column(name = "start_at", nullable = false)
    public Instant startAt;

    @Column(name = "end_at", nullable = false)
    public Instant endAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 16)
    public AbsenceType type;

    @Column(name = "reason", length = 255)
    public String reason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;
}
