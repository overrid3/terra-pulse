package com.terrapulse.repository;

import com.terrapulse.domain.client.Client;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.UUID;

@ApplicationScoped
public class ClientRepository implements PanacheRepositoryBase<Client, UUID> {

    public Client findByEmail(String email) {
        return find("lower(email) = lower(?1)", email).firstResult();
    }
}
