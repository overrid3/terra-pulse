package com.terrapulse.repository;

import com.terrapulse.domain.site.Site;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class SiteRepository implements PanacheRepositoryBase<Site, UUID> {

    public List<Site> findByClientId(UUID clientId) {
        return list("client.id = ?1", clientId);
    }
}
