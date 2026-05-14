package com.terrapulse.domain.reservation;

import com.terrapulse.domain.mechanic.Mechanic;
import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "wet_hire_reservation")
@DiscriminatorValue("WET_HIRE")
@PrimaryKeyJoinColumn(name = "id")
public class WetHireReservation extends Reservation {

    @Column(name = "hourly_rate", nullable = false, precision = 10, scale = 2)
    public BigDecimal hourlyRate;

    @ManyToOne
    @JoinColumn(name = "operator_mechanic_id")
    public Mechanic operatorMechanic;

    @Override
    public HireType hireType() {
        return HireType.WET_HIRE;
    }
}
