CREATE INDEX mechanic_location_gix ON mechanic USING GIST (location);
CREATE INDEX service_order_site_location_gix ON service_order USING GIST (site_location);
