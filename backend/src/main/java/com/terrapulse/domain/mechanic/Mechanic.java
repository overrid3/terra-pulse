package com.terrapulse.domain.mechanic;

import com.terrapulse.domain.skill.Skill;
import com.terrapulse.service.PointAttributeConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.locationtech.jts.geom.Point;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "mechanic")
public class Mechanic {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    public UUID id;

    @Column(name = "full_name", nullable = false, length = 128)
    public String fullName;

    @Column(name = "phone", length = 32)
    public String phone;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "mechanic_skill",
            joinColumns = @JoinColumn(name = "mechanic_id"),
            inverseJoinColumns = @JoinColumn(name = "skill_id"))
    public Set<Skill> skills = new HashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    public MechanicStatus status = MechanicStatus.IDLE;

    @Column(name = "location", columnDefinition = "geometry(Point,4326)")
    @Convert(converter = PointAttributeConverter.class)
    public Point location;

    @Column(name = "location_updated_at")
    public Instant locationUpdatedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;
}
