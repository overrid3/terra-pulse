package com.terrapulse.ws;

import java.time.Instant;

public record DispatchEvent(String type, Instant occurredAt, Object payload) {

    public static DispatchEvent of(String type, Object payload) {
        return new DispatchEvent(type, Instant.now(), payload);
    }

    public static final String SERVICE_ORDER_CREATED          = "SERVICE_ORDER_CREATED";
    public static final String SERVICE_ORDER_UPDATED          = "SERVICE_ORDER_UPDATED";
    public static final String SERVICE_ORDER_STATE_CHANGED    = "SERVICE_ORDER_STATE_CHANGED";
    public static final String SERVICE_ORDER_SCHEDULE_CHANGED = "SERVICE_ORDER_SCHEDULE_CHANGED";
    public static final String SERVICE_ORDER_DELETED          = "SERVICE_ORDER_DELETED";
    public static final String MECHANIC_LOCATION_UPDATED      = "MECHANIC_LOCATION_UPDATED";
    public static final String MECHANIC_STATUS_CHANGED        = "MECHANIC_STATUS_CHANGED";
}
