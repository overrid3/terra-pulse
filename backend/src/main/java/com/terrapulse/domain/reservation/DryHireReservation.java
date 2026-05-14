package com.terrapulse.domain.reservation;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "dry_hire_reservation")
@DiscriminatorValue("DRY_HIRE")
@PrimaryKeyJoinColumn(name = "id")
public class DryHireReservation extends Reservation {

    @Column(name = "daily_rate", nullable = false, precision = 10, scale = 2)
    public BigDecimal dailyRate;

    @Override
    public HireType hireType() {
        return HireType.DRY_HIRE;
    }
}
