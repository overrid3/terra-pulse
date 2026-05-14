package com.terrapulse.api.dto;

import org.locationtech.jts.geom.Point;

public record LatLng(double lat, double lng) {

    public static LatLng of(Point p) {
        if (p == null) return null;
        return new LatLng(p.getY(), p.getX());
    }
}
