package com.terrapulse.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Path("/api/geo")
@Produces(MediaType.APPLICATION_JSON)
public class GeoResource {

    private static final Logger LOG = Logger.getLogger(GeoResource.class);

    @ConfigProperty(name = "terrapulse.geocoding.nominatim-base", defaultValue = "https://nominatim.openstreetmap.org")
    String nominatimBase;

    @ConfigProperty(name = "terrapulse.geocoding.user-agent",
            defaultValue = "TerraPulse-POC (contact: support@terrapulse.local)")
    String userAgent;

    private final ObjectMapper json;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    @Inject
    public GeoResource(ObjectMapper json) {
        this.json = json;
    }

    public record GeocodeResult(double lat, double lng, String displayName) {}

    @GET
    @Path("/geocode")
    public List<GeocodeResult> geocode(@QueryParam("q") String q,
                                       @QueryParam("limit") Integer limit) {
        if (q == null || q.isBlank()) {
            throw new WebApplicationException("query 'q' is required", Response.Status.BAD_REQUEST);
        }
        int cap = (limit == null || limit < 1 || limit > 10) ? 5 : limit;
        String url = nominatimBase + "/search?format=jsonv2&addressdetails=0&limit=" + cap
                + "&q=" + URLEncoder.encode(q, StandardCharsets.UTF_8);

        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .header("User-Agent", userAgent)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(8))
                .GET()
                .build();

        HttpResponse<String> res;
        try {
            res = http.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            LOG.warnf(e, "nominatim call failed for q=%s", q);
            throw new WebApplicationException("geocoding service unreachable",
                    Response.Status.BAD_GATEWAY);
        }
        if (res.statusCode() / 100 != 2) {
            LOG.warnf("nominatim status=%d body=%s", res.statusCode(), res.body());
            throw new WebApplicationException("geocoding service returned " + res.statusCode(),
                    Response.Status.BAD_GATEWAY);
        }

        try {
            JsonNode arr = json.readTree(res.body());
            List<GeocodeResult> out = new ArrayList<>();
            for (JsonNode n : arr) {
                double lat = n.path("lat").asDouble();
                double lon = n.path("lon").asDouble();
                String name = n.path("display_name").asText("");
                out.add(new GeocodeResult(lat, lon, name));
            }
            return out;
        } catch (IOException e) {
            LOG.warnf(e, "failed to parse nominatim response");
            throw new WebApplicationException("invalid geocoding response",
                    Response.Status.BAD_GATEWAY);
        }
    }
}
