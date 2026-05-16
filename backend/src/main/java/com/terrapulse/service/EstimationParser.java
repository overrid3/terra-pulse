package com.terrapulse.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class EstimationParser {

    private EstimationParser() {}

    private static final int MIN_PER_D = 480;   // 8h work-day
    private static final int MIN_PER_H = 60;
    private static final Pattern TOKEN = Pattern.compile("(\\d+(?:\\.\\d+)?)([dhm])");
    private static final Pattern BARE  = Pattern.compile("\\d+(?:\\.\\d+)?");

    public static int parse(String input) {
        if (input == null) throw new IllegalArgumentException("input required");
        String s = input.trim().toLowerCase();
        if (s.isEmpty()) throw new IllegalArgumentException("input empty");

        if (BARE.matcher(s).matches()) {
            return (int) Math.round(Double.parseDouble(s));
        }

        String stripped = s.replaceAll("\\s+", "");
        Matcher m = TOKEN.matcher(stripped);
        double total = 0;
        int consumed = 0;
        boolean matched = false;
        while (m.find()) {
            matched = true;
            double n = Double.parseDouble(m.group(1));
            char unit = m.group(2).charAt(0);
            total += switch (unit) {
                case 'd' -> n * MIN_PER_D;
                case 'h' -> n * MIN_PER_H;
                case 'm' -> n;
                default  -> throw new IllegalArgumentException("unknown unit: " + unit);
            };
            consumed += m.group().length();
        }
        if (!matched || consumed != stripped.length()) {
            throw new IllegalArgumentException("invalid duration: " + input);
        }
        return (int) Math.round(total);
    }
}
