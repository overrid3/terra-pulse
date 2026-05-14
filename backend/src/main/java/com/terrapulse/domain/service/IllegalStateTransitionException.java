package com.terrapulse.domain.service;

public class IllegalStateTransitionException extends RuntimeException {

    public IllegalStateTransitionException(ServiceOrderState from, ServiceOrderState to) {
        super("Illegal state transition: " + from + " -> " + to);
    }

    public IllegalStateTransitionException(String message) {
        super(message);
    }
}
