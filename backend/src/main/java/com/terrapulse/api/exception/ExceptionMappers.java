package com.terrapulse.api.exception;

import com.terrapulse.domain.service.IllegalStateTransitionException;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.server.ServerExceptionMapper;

import java.util.Map;

public class ExceptionMappers {

    @ServerExceptionMapper
    public Response illegalStateTransition(IllegalStateTransitionException e) {
        return Response.status(Response.Status.CONFLICT)
                .entity(Map.of("error", "illegal_state_transition", "message", e.getMessage()))
                .build();
    }

    @ServerExceptionMapper
    public Response illegalArgument(IllegalArgumentException e) {
        return Response.status(Response.Status.BAD_REQUEST)
                .entity(Map.of("error", "bad_request", "message", e.getMessage()))
                .build();
    }
}
