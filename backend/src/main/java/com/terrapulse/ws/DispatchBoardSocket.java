package com.terrapulse.ws;

import io.quarkus.logging.Log;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.inject.Inject;

/**
 * Server-push only socket. Inbound messages are ignored — the dispatch board is read-only on this channel.
 */
@WebSocket(path = "/ws/dispatch")
public class DispatchBoardSocket {

    WebSocketConnection connection;

    public DispatchBoardSocket(WebSocketConnection connection) {
        this.connection = connection;
    }

    @OnOpen
    public void onOpen() {
        Log.infof("Dispatch WS connection opened: %s", connection.id());
    }

    @OnClose
    public void onClose() {
        Log.infof("Dispatch WS connection closed: %s", connection.id());
    }

    @OnTextMessage
    public void onMessage(String ignored) {
        // no-op: server-push only
    }
}
