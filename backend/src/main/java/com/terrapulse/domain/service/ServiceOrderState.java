package com.terrapulse.domain.service;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public enum ServiceOrderState {
    REQUESTED,
    QUOTED,
    APPROVED,
    DISPATCHED,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED;

    private static final Map<ServiceOrderState, Set<ServiceOrderState>> ALLOWED = Map.of(
            REQUESTED,   EnumSet.of(QUOTED, CANCELLED),
            QUOTED,      EnumSet.of(APPROVED, CANCELLED),
            APPROVED,    EnumSet.of(DISPATCHED, CANCELLED),
            DISPATCHED,  EnumSet.of(IN_PROGRESS, CANCELLED),
            IN_PROGRESS, EnumSet.of(COMPLETED),
            COMPLETED,   EnumSet.noneOf(ServiceOrderState.class),
            CANCELLED,   EnumSet.noneOf(ServiceOrderState.class)
    );

    public boolean canTransitionTo(ServiceOrderState target) {
        return ALLOWED.get(this).contains(target);
    }

    public boolean isTerminal() {
        return ALLOWED.get(this).isEmpty();
    }
}
