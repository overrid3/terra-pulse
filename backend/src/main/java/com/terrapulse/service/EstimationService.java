package com.terrapulse.service;

import com.terrapulse.domain.vmrs.VmrsCode;
import jakarta.enterprise.context.ApplicationScoped;

import java.math.BigDecimal;
import java.math.RoundingMode;

@ApplicationScoped
public class EstimationService {

    public int estimateMinutes(VmrsCode code) {
        BigDecimal minutes = BigDecimal.valueOf(code.srtMinutes)
                .multiply(code.difficultyFactor)
                .setScale(0, RoundingMode.CEILING);
        return minutes.intValueExact();
    }
}
