package com.terrapulse.repository;

import com.terrapulse.domain.skill.Skill;
import io.quarkus.hibernate.reactive.panache.PanacheRepositoryBase;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class SkillRepository implements PanacheRepositoryBase<Skill, UUID> {

    public Uni<Skill> findByName(String name) {
        return find("lower(name) = ?1", name.toLowerCase()).firstResult();
    }

    public Uni<Skill> findOrCreate(String name) {
        return findByName(name).flatMap(found -> {
            if (found != null) return Uni.createFrom().item(found);
            Skill s = new Skill();
            s.name = name;
            return persist(s).replaceWith(s);
        });
    }

    public Uni<List<Skill>> findAllSorted() {
        return list("ORDER BY lower(name)");
    }
}
