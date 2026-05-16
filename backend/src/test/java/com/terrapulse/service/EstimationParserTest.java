package com.terrapulse.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

class EstimationParserTest {

    @ParameterizedTest
    @CsvSource(textBlock = """
            '1d',       480
            '2h30m',    150
            '1.5h',     90
            '90',       90
            '1d 2h',    600
            '0m',       0
            '2h',       120
            '15m',      15
            """)
    void parse_validInputs(String input, int expected) {
        assertEquals(expected, EstimationParser.parse(input));
    }

    @Test
    void parse_empty_throws() {
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse(""));
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse("   "));
    }

    @Test
    void parse_invalid_throws() {
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse("abc"));
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse("1y"));
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse("1d junk"));
    }

    @Test
    void parse_null_throws() {
        assertThrows(IllegalArgumentException.class, () -> EstimationParser.parse(null));
    }
}
