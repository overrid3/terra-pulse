package com.terrapulse.repository;

import com.terrapulse.domain.vmrs.VmrsCode;
import io.quarkus.hibernate.reactive.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class VmrsCodeRepository implements PanacheRepositoryBase<VmrsCode, String> {
}
