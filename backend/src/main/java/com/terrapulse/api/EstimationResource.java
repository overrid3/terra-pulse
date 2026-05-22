package com.terrapulse.api;

import com.terrapulse.service.EstimationParser;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.Map;

import io.quarkus.security.Authenticated;

@Path("/api/estimation")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Authenticated
public class EstimationResource {

    public record ParseRequest(String input) {}

    @POST
    @Path("/parse")
    public Response parse(ParseRequest in) {
        try {
            int minutes = EstimationParser.parse(in == null ? null : in.input());
            return Response.ok(Map.of("minutes", minutes)).build();
        } catch (IllegalArgumentException ex) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "invalid_estimation", "message", ex.getMessage()))
                    .build();
        }
    }
}
