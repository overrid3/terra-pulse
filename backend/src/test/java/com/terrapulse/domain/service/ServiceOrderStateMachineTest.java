package com.terrapulse.domain.service;

import com.terrapulse.domain.mechanic.Mechanic;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

class ServiceOrderStateMachineTest {

    private ServiceOrder approvedOrder() {
        ServiceOrder so = new ServiceOrder();
        so.state = ServiceOrderState.APPROVED;
        so.estimatedMinutes = 60;
        return so;
    }

    @Test
    void scheduled_requiresMechanic() {
        ServiceOrder so = approvedOrder();
        so.scheduledStartAt = Instant.now();
        so.scheduledEndAt = so.scheduledStartAt.plus(1, ChronoUnit.HOURS);
        IllegalStateTransitionException ex = assertThrows(
                IllegalStateTransitionException.class,
                () -> ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.SCHEDULED)
        );
        assertTrue(ex.getMessage().contains("mechanic"));
    }

    @Test
    void scheduled_requiresStartAndEnd() {
        ServiceOrder so = approvedOrder();
        so.mechanic = new Mechanic();
        IllegalStateTransitionException ex = assertThrows(
                IllegalStateTransitionException.class,
                () -> ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.SCHEDULED)
        );
        assertTrue(ex.getMessage().contains("scheduledStartAt"));
    }

    @Test
    void scheduled_endMustBeAfterStart() {
        ServiceOrder so = approvedOrder();
        so.mechanic = new Mechanic();
        Instant t = Instant.now();
        so.scheduledStartAt = t.plus(1, ChronoUnit.HOURS);
        so.scheduledEndAt = t;
        assertThrows(IllegalStateTransitionException.class,
                () -> ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.SCHEDULED));
    }

    @Test
    void scheduled_happyPath() {
        ServiceOrder so = approvedOrder();
        so.mechanic = new Mechanic();
        Instant t = Instant.now();
        so.scheduledStartAt = t;
        so.scheduledEndAt = t.plus(1, ChronoUnit.HOURS);
        ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.SCHEDULED);
        assertEquals(ServiceOrderState.SCHEDULED, so.state);
    }

    @Test
    void inProgress_fromScheduled_setsStartedAt() {
        ServiceOrder so = approvedOrder();
        so.state = ServiceOrderState.SCHEDULED;
        ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.IN_PROGRESS);
        assertEquals(ServiceOrderState.IN_PROGRESS, so.state);
        assertNotNull(so.startedAt);
    }

    @Test
    void approved_cannotSkipToInProgress() {
        ServiceOrder so = approvedOrder();
        assertThrows(IllegalStateTransitionException.class,
                () -> ServiceOrderStateMachine.transitionTo(so, ServiceOrderState.IN_PROGRESS));
    }
}
