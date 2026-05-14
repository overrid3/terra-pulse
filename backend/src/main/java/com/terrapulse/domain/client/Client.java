package com.terrapulse.domain.client;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "client")
public class Client {

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

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;
}
