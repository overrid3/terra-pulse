package com.terrapulse.repository;

import com.terrapulse.domain.service.ServiceOrder;
import com.terrapulse.domain.service.ServiceOrderState;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Parameters;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class ServiceOrderRepository implements PanacheRepositoryBase<ServiceOrder, UUID> {

    public List<ServiceOrder> filter(ServiceOrderState stateOrNull,
                                     UUID mechanicIdOrNull,
                                     UUID vehicleIdOrNull) {
        if (stateOrNull == null && mechanicIdOrNull == null && vehicleIdOrNull == null) {
            return listAll();
        }
        StringBuilder jpql = new StringBuilder("1=1");
        Parameters params = new Parameters();
        if (stateOrNull != null) {
            jpql.append(" and state = :state");
            params.and("state", stateOrNull);
        }
        if (mechanicIdOrNull != null) {
            jpql.append(" and mechanic.id = :mechanicId");
            params.and("mechanicId", mechanicIdOrNull);
        }
        if (vehicleIdOrNull != null) {
            jpql.append(" and vehicle.id = :vehicleId");
            params.and("vehicleId", vehicleIdOrNull);
        }
        return list(jpql.toString(), params);
    }
}
