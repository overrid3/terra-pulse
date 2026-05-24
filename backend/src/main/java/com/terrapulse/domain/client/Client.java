package com.terrapulse.domain.client;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Cacheable
@Table(name = "client")
public class Client extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    public UUID id;

    @Column(name = "name", nullable = false, length = 255)
    public String name;

    @Column(name = "email", nullable = false, length = 255)
    public String email;

    @Column(name = "phone", length = 32)
    public String phone;

    @Column(name = "vat_number", length = 32)
    public String vatNumber;

    @Column(name = "address_line1", length = 255)
    public String addressLine1;

    @Column(name = "address_line2", length = 255)
    public String addressLine2;

    @Column(name = "city", length = 128)
    public String city;

    @Column(name = "postal_code", length = 16)
    public String postalCode;

    @Column(name = "country", length = 64)
    public String country;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 16)
    public ClientState state = ClientState.ACTIVE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;
}
