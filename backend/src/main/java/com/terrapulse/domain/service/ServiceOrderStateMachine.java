package com.terrapulse.domain.service;

import java.time.Instant;

public final class ServiceOrderStateMachine {

    private ServiceOrderStateMachine() {}

    public static void transitionTo(ServiceOrder order, ServiceOrderState target) {
        ServiceOrderState current = order.state;
        if (!current.canTransitionTo(target)) {
            throw new IllegalStateTransitionException(current, target);
        }

        switch (target) {
            case QUOTED -> {
                if (order.estimatedMinutes == null || order.estimatedMinutes <= 0) {
                    throw new IllegalStateTransitionException("estimatedMinutes must be set before QUOTED");
                }
            }
            case SCHEDULED -> {
                if (order.mechanic == null) {
                    throw new IllegalStateTransitionException("mechanic must be assigned before SCHEDULED");
                }
                if (order.scheduledStartAt == null || order.scheduledEndAt == null) {
                    throw new IllegalStateTransitionException("scheduledStartAt and scheduledEndAt must be set before SCHEDULED");
                }
                if (!order.scheduledEndAt.isAfter(order.scheduledStartAt)) {
                    throw new IllegalStateTransitionException("scheduledEndAt must be after scheduledStartAt");
                }
            }
            case IN_PROGRESS -> order.startedAt = Instant.now();
            case COMPLETED -> {
                if (order.actualMinutes == null || order.actualMinutes <= 0) {
                    throw new IllegalStateTransitionException("actualMinutes must be set before COMPLETED");
                }
                order.completedAt = Instant.now();
            }
            default -> { /* no extra guards */ }
        }

        order.state = target;
    }
}
