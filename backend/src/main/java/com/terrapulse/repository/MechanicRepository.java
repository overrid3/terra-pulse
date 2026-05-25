package com.terrapulse.repository;

import com.terrapulse.domain.mechanic.Mechanic;
import io.quarkus.hibernate.reactive.panache.PanacheRepositoryBase;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.hibernate.reactive.mutiny.Mutiny;

import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class MechanicRepository implements PanacheRepositoryBase<Mechanic, UUID> {

    @Inject
    Mutiny.SessionFactory factory;

    @SuppressWarnings("unchecked")
    public Uni<List<Mechanic>> findNearest(double lat, double lng, int limit, String skillOrNull) {
        String base = """
                SELECT m.* FROM mechanic m
                WHERE m.location IS NOT NULL
                """;
        String tail = """
                ORDER BY m.location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
                LIMIT :lim
                """;
        String skillClause = """
                 AND EXISTS (
                    SELECT 1 FROM mechanic_skill ms
                    JOIN skill s ON s.id = ms.skill_id
                    WHERE ms.mechanic_id = m.id AND lower(s.name) = lower(:skill)
                 )
                """;
        String sql = (skillOrNull == null) ? base + tail : base + skillClause + tail;
        String finalSkill = skillOrNull;

        return factory.withSession(session -> {
            var query = session.createNativeQuery(sql, Mechanic.class)
                    .setParameter("lat", lat)
                    .setParameter("lng", lng)
                    .setParameter("lim", limit);
            if (finalSkill != null) query.setParameter("skill", finalSkill);
            return query.getResultList().flatMap(list -> {
                // Initialize lazy skills collection for each mechanic within this session
                Uni<Void> init = Uni.createFrom().voidItem();
                for (Mechanic m : list) {
                    final Mechanic ref = m;
                    init = init.flatMap(v -> session.fetch(ref.skills).replaceWithVoid());
                }
                return init.replaceWith(list);
            });
        });
    }
}
