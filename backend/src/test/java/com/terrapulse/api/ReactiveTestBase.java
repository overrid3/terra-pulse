package com.terrapulse.api;

import io.quarkus.vertx.core.runtime.context.VertxContextSafetyToggle;
import io.smallrye.common.vertx.VertxContext;
import io.smallrye.mutiny.Uni;
import io.vertx.core.Context;
import io.vertx.core.Vertx;
import jakarta.inject.Inject;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * Base class for tests that need to call Hibernate Reactive Panache from
 * plain JUnit (non-Vert.x) threads.
 *
 * <p>Quarkus 3.x requires reactive operations to run on a <em>duplicated</em>
 * Vert.x context marked as safe.  {@link #runBlocking(Supplier)} creates such a
 * context and blocks the calling thread until the reactive pipeline completes.
 */
public abstract class ReactiveTestBase {

    @Inject
    Vertx vertx;

    protected <T> T runBlocking(Supplier<Uni<T>> uniSupplier) {
        CompletableFuture<T> cf = new CompletableFuture<>();
        Context duplicated = VertxContext.getOrCreateDuplicatedContext(vertx);
        VertxContextSafetyToggle.setContextSafe(duplicated, true);
        duplicated.runOnContext(ignored -> {
            try {
                uniSupplier.get().subscribe().with(cf::complete, cf::completeExceptionally);
            } catch (Exception e) {
                cf.completeExceptionally(e);
            }
        });
        try {
            return cf.get(30, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}

