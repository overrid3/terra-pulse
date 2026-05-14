package com.terrapulse.service;

import jakarta.enterprise.context.ApplicationScoped;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;

@ApplicationScoped
public class GeometrySupport {

    private static final int SRID_WGS84 = 4326;
    private final GeometryFactory factory = new GeometryFactory(new PrecisionModel(), SRID_WGS84);

    public Point point(double lng, double lat) {
        Point p = factory.createPoint(new Coordinate(lng, lat));
        p.setSRID(SRID_WGS84);
        return p;
    }
}
