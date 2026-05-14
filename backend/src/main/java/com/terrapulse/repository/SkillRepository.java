package com.terrapulse.repository;

import com.terrapulse.domain.skill.Skill;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class SkillRepository implements PanacheRepositoryBase<Skill, UUID> {

    public Optional<Skill> findByName(String name) {
        return find("lower(name) = ?1", name.toLowerCase()).firstResultOptional();
    }

    public Skill findOrCreate(String name) {
        return findByName(name).orElseGet(() -> {
            Skill s = new Skill();
            s.name = name;
            persist(s);
            return s;
        });
    }

    public List<Skill> findAllSorted() {
        return list("ORDER BY lower(name)");
    }
}
