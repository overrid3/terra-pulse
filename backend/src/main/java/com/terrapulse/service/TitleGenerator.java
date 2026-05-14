package com.terrapulse.service;

import com.terrapulse.domain.vehicle.Vehicle;
import com.terrapulse.domain.vmrs.VmrsCode;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Builds a human-readable, semi-unique handle for a service order:
 * {@code "<VMRS-SHORT> · <SERIAL-SUFFIX> · <RAND4>"}.
 *
 * <p>The shape is stable so logs and chat references stay legible. RAND4 keeps
 * duplicates across the same vehicle/VMRS combo distinguishable — collisions
 * are statistically rare (1/65k) and the column is not declared unique.
 *
 * <p>Length is hard-capped at {@value #MAX_LEN}. If the assembled string would
 * exceed that, the VMRS short form is truncated first — the suffix and RAND4
 * are load-bearing for identification and never touched.
 */
@ApplicationScoped
public class TitleGenerator {

    static final int MAX_LEN = 120;
    static final int VMRS_SHORT_MAX = 30;
    static final String SEP = " · ";

    public String generate(Vehicle v, VmrsCode c) {
        String vmrsShort = vmrsShort(c == null ? null : c.description);
        String serialSuffix = serialSuffix(v == null ? null : v.serialNumber);
        String rand4 = rand4();

        String candidate = vmrsShort + SEP + serialSuffix + SEP + rand4;
        if (candidate.length() <= MAX_LEN) {
            return candidate;
        }
        // Only the VMRS portion may be trimmed; SEPs, suffix and RAND4 stay.
        int fixed = SEP.length() + serialSuffix.length() + SEP.length() + rand4.length();
        int allowed = Math.max(0, MAX_LEN - fixed);
        String trimmed = vmrsShort.length() > allowed ? vmrsShort.substring(0, allowed) : vmrsShort;
        trimmed = stripTrailingNoise(trimmed);
        return trimmed + SEP + serialSuffix + SEP + rand4;
    }

    private static String vmrsShort(String description) {
        if (description == null || description.isBlank()) return "service";
        String cut = description.length() > VMRS_SHORT_MAX
                ? description.substring(0, VMRS_SHORT_MAX)
                : description;
        return stripTrailingNoise(cut);
    }

    private static String serialSuffix(String serial) {
        if (serial == null || serial.isBlank()) return "----";
        String src = serial.trim();
        String tail = src.length() >= 4 ? src.substring(src.length() - 4) : src;
        return tail.toUpperCase(Locale.ROOT);
    }

    private static String rand4() {
        int n = ThreadLocalRandom.current().nextInt(0x10000); // 0..65535
        return String.format(Locale.ROOT, "%04X", n);
    }

    /**
     * Trim trailing whitespace and ASCII punctuation so the truncated string
     * doesn't dangle on a partial word like {@code "filter +"}.
     */
    private static String stripTrailingNoise(String s) {
        int end = s.length();
        while (end > 0) {
            char ch = s.charAt(end - 1);
            if (Character.isWhitespace(ch) || isTrailingPunct(ch)) {
                end--;
            } else {
                break;
            }
        }
        return s.substring(0, end);
    }

    private static boolean isTrailingPunct(char ch) {
        switch (ch) {
            case '.': case ',': case ';': case ':': case '!': case '?':
            case '-': case '_': case '+': case '*': case '/': case '\\':
            case '(': case ')': case '[': case ']': case '{': case '}':
            case '\'': case '"': case '`': case '~':
                return true;
            default:
                return false;
        }
    }
}
