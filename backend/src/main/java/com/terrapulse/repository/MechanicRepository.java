package com.terrapulse.repository;

import com.terrapulse.domain.mechanic.Mechanic;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.PersistenceContext;

import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class MechanicRepository implements PanacheRepositoryBase<Mechanic, UUID> {

    @PersistenceContext
    EntityManager em;

    /**
     * KNN search via GIST index. {@code <->} on geometry returns 2D distance in degree units;
     * we use it purely for ordering — the result list is converted back to entities.
     */
    @SuppressWarnings("unchecked")
    public List<Mechanic> findNearest(double lat, double lng, int limit, String skillOrNull) {
        String base = """
                SELECT m.* FROM mechanic m
                WHERE m.location IS NOT NULL
                """;
        String tail = """
                ORDER BY m.location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
                LIMIT :lim
                """;
        // After V8 skills moved to a join table; filter via EXISTS on skill name.
        String skillClause = """
                 AND EXISTS (
                    SELECT 1 FROM mechanic_skill ms
                    JOIN skill s ON s.id = ms.skill_id
                    WHERE ms.mechanic_id = m.id AND lower(s.name) = lower(:skill)
                 )
                """;
        String sql = (skillOrNull == null) ? base + tail : base + skillClause + tail;

        Query q = em.createNativeQuery(sql, Mechanic.class)
                .setParameter("lat", lat)
                .setParameter("lng", lng)
                .setParameter("lim", limit);
        if (skillOrNull != null) q.setParameter("skill", skillOrNull);
        return q.getResultList();
    }
}
