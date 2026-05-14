package com.terrapulse.service;

import com.terrapulse.domain.vehicle.Vehicle;
import com.terrapulse.domain.vmrs.VmrsCode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Shape tests for {@link TitleGenerator}. RAND4 is non-deterministic so we
 * assert structure (separators, lengths, content of fixed parts) rather than
 * exact equality.
 */
class TitleGeneratorTest {

    private final TitleGenerator gen = new TitleGenerator();

    private static Vehicle vehicle(String serial) {
        Vehicle v = new Vehicle();
        v.serialNumber = serial;
        return v;
    }

    private static VmrsCode vmrs(String description) {
        VmrsCode c = new VmrsCode();
        c.code = "001-001-1";
        c.description = description;
        return c;
    }

    @Test
    void normalCase_producesThreePartsSeparatedByMiddot() {
        String title = gen.generate(vehicle("SN-AAA4F2"), vmrs("Engine oil + filter"));
        String[] parts = title.split(" · ");
        assertEquals(3, parts.length, "expected three ' · '-separated parts: " + title);
        assertEquals("Engine oil + filter", parts[0]);
        assertEquals("A4F2", parts[1]);
        assertEquals(4, parts[2].length(), "RAND4 should be 4 chars");
        assertTrue(parts[2].matches("[0-9A-F]{4}"), "RAND4 should be uppercase hex, was: " + parts[2]);
        assertTrue(title.length() <= 120);
    }

    @Test
    void shortSerial_isUsedWholeAndUppercased() {
        String title = gen.generate(vehicle("ab"), vmrs("Tyres"));
        String[] parts = title.split(" · ");
        assertEquals("AB", parts[1], "short serial should be returned whole and uppercased");
    }

    @Test
    void emptyOrNullSerial_fallsBackToPlaceholder() {
        String t1 = gen.generate(vehicle(""), vmrs("Tyres"));
        String t2 = gen.generate(vehicle(null), vmrs("Tyres"));
        assertEquals("----", t1.split(" · ")[1]);
        assertEquals("----", t2.split(" · ")[1]);
    }

    @Test
    void veryLongDescription_isTrimmedToThirtyAndStripsTrailingNoise() {
        // 50-char description ending in punctuation/space inside the cut zone.
        String desc = "Replace the entire hydraulic-system + lines and pump.";
        String title = gen.generate(vehicle("XYZ1234"), vmrs(desc));
        String[] parts = title.split(" · ");
        // VMRS short must not exceed 30 chars, and trailing whitespace/
        // punctuation must be stripped.
        assertTrue(parts[0].length() <= 30, "VMRS-SHORT > 30: '" + parts[0] + "'");
        char last = parts[0].charAt(parts[0].length() - 1);
        assertFalse(Character.isWhitespace(last), "trailing whitespace not stripped");
        assertFalse("+,.;:-_".indexOf(last) >= 0, "trailing punctuation not stripped");
        assertEquals("1234", parts[1]);
        assertEquals(4, parts[2].length());
    }

    @Test
    void specialCharactersInDescription_arePreservedInsideTheCut() {
        String desc = "A/C — recharge & leak-check (R134a)";
        String title = gen.generate(vehicle("SN0001"), vmrs(desc));
        String[] parts = title.split(" · ");
        assertNotNull(parts[0]);
        assertTrue(parts[0].startsWith("A/C"), "should preserve leading special chars: " + parts[0]);
        assertTrue(parts[0].length() <= 30);
        assertEquals("0001", parts[1]);
    }

    @Test
    void resultNeverExceedsMaxLength() {
        // Pathological: 200-char description, long serial. Generator must still
        // honour the 120-char cap by trimming VMRS-SHORT.
        String longDesc = "x".repeat(200);
        for (int i = 0; i < 50; i++) {
            String title = gen.generate(vehicle("AAAA"), vmrs(longDesc));
            assertTrue(title.length() <= 120, "title exceeded 120: len=" + title.length());
            // Suffix and RAND4 always present and correctly shaped.
            String[] parts = title.split(" · ");
            assertEquals(3, parts.length);
            assertEquals("AAAA", parts[1]);
            assertTrue(parts[2].matches("[0-9A-F]{4}"));
        }
    }
}
