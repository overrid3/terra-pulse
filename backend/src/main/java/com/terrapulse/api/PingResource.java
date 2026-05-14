package com.terrapulse.api;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.time.Instant;
import java.util.Map;

@Path("/api/ping")
public class PingResource {

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> ping() {
        return Map.of(
                "status", "ok",
                "service", "terrapulse-backend",
                "time", Instant.now().toString()
        );
    }
}
