package com.terrapulse.domain.vmrs;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "vmrs_code")
public class VmrsCode {

    @Id
    @Column(name = "code", nullable = false, length = 9)
    public String code;

    @Column(name = "description", nullable = false, length = 255)
    public String description;

    @Column(name = "srt_minutes", nullable = false)
    public Integer srtMinutes;

    @Column(name = "difficulty_factor", nullable = false, precision = 3, scale = 2)
    public BigDecimal difficultyFactor = BigDecimal.ONE;
}
