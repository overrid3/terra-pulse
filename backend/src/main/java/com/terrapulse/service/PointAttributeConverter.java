package com.terrapulse.service;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.locationtech.jts.io.ByteOrderValues;
import org.locationtech.jts.io.ParseException;
import org.locationtech.jts.io.WKBReader;
import org.locationtech.jts.io.WKBWriter;

/**
 * Converts between a JTS {@link Point} and its EWKB hex-string representation
 * so that Hibernate Reactive (Vert.x PG client) can bind/extract geometry values.
 *
 * <p>The Vert.x pg client does not understand JDBC {@code PGobject}; sending the
 * EWKB value as a plain {@code String} works because PostgreSQL accepts EWKB hex
 * for geometry columns when the parameter type-OID is {@code 0} (unknown).
 */
@Converter
public class PointAttributeConverter implements AttributeConverter<Point, String> {

    private static final int SRID_WGS84 = 4326;
    private static final GeometryFactory GF =
            new GeometryFactory(new PrecisionModel(), SRID_WGS84);

    @Override
    public String convertToDatabaseColumn(Point point) {
        if (point == null) return null;
        // EWKB, little-endian, with SRID prefix
        byte[] ewkb = new WKBWriter(2, ByteOrderValues.LITTLE_ENDIAN, true).write(point);
        return WKBWriter.toHex(ewkb);
    }

    @Override
    public Point convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return (Point) new WKBReader(GF).read(WKBReader.hexToBytes(dbData));
        } catch (ParseException e) {
            throw new RuntimeException("Cannot parse geometry from: " + dbData, e);
        }
    }
}

