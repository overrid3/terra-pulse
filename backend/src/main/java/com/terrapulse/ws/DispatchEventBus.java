package com.terrapulse.ws;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.logging.Log;
import io.quarkus.websockets.next.OpenConnections;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class DispatchEventBus {

    OpenConnections connections;
    ObjectMapper mapper;

    public DispatchEventBus(OpenConnections connections, ObjectMapper mapper) {
        this.connections = connections;
        this.mapper = mapper;
    }

    public void publish(DispatchEvent event) {
        String json;
        try {
            json = mapper.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            Log.errorf(e, "Failed to serialize dispatch event %s", event.type());
            return;
        }
        int n = 0;
        for (WebSocketConnection c : connections.listAll()) {
            c.sendText(json).subscribe().with(
                    ignored -> { /* sent */ },
                    err -> Log.warnf(err, "Failed to push to WS %s", c.id())
            );
            n++;
        }
        Log.debugf("Published %s to %d WS connection(s)", event.type(), n);
    }
}
