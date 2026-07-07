import { describe, it, expect } from "vitest";
import { extractJson, parseScoringResult } from "./parse-scoring";

describe("parse-scoring.ts", () => {
  describe("extractJson", () => {
    it("extracts fenced JSON (```json ... ```)", () => {
      const raw = '```json\n{"key": "value"}\n```';
      const extracted = extractJson(raw);
      expect(() => JSON.parse(extracted)).not.toThrow();
      expect(JSON.parse(extracted)).toEqual({ key: "value" });
    });

    it("extracts JSON with preamble text and fallback to first { to last }", () => {
      // WHY: models sometimes emit "Here is the JSON…" before the payload
      const raw = 'Here is the JSON response:\n{"key": "value"}';
      const extracted = extractJson(raw);
      expect(() => JSON.parse(extracted)).not.toThrow();
      expect(JSON.parse(extracted)).toEqual({ key: "value" });
    });

    it("handles bare JSON without fences", () => {
      const raw = '{"key": "value"}';
      const extracted = extractJson(raw);
      expect(() => JSON.parse(extracted)).not.toThrow();
      expect(JSON.parse(extracted)).toEqual({ key: "value" });
    });
  });

  describe("parseScoringResult", () => {
    const validPayload = {
      exam: "IELTS",
      word_count: 0, // will be overwritten
      overall_band: 0, // will be overwritten
      criteria: {
        task_response: { band: 6.5, strengths_noted: "Good", rationale: "Clear structure" },
        coherence_cohesion: { band: 6.0, strengths_noted: "OK", rationale: "Some linking" },
      },
      weakest_criterion: "coherence_cohesion",
      weaknesses: [
        {
          issue: "Poor paragraph transitions",
          criterion: "coherence_cohesion",
          quoted_example: "sentence 1... sentence 2",
          explanation: "No linker",
          fix: "Add 'Furthermore'",
        },
      ],
      vocabulary_upgrades: [
        { original: "good", upgrade: "excellent", why: "More precise" },
      ],
      model_paragraph: {
        original: "This is original",
        rewrite: "This is rewritten",
        target_band: 7,
        criterion_improved: "lexical_resource",
        changes_explained: "Upgraded vocabulary",
      },
      examiner_summary: "Overall strong response",
    };

    it("parses valid, fenced JSON payload", () => {
      // WHY: models wrap output in ```json fences despite instructions
      const raw = `\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\``;
      const result = parseScoringResult(raw);
      expect(result).not.toBeNull();
      expect(result?.exam).toBe("IELTS");
      expect(result?.criteria.task_response?.band).toBe(6.5);
      expect(result?.weaknesses.length).toBe(1);
      expect(result?.weaknesses[0].issue).toBe("Poor paragraph transitions");
    });

    it("returns null when criteria is missing", () => {
      // WHY: a bad payload must trigger the retry path, never reach the DB — a stored bad payload crashes the dashboard detail page forever
      const payload = { ...validPayload, criteria: undefined };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).toBeNull();
    });

    it("returns null when criteria is not an object", () => {
      const payload = { ...validPayload, criteria: [] };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).toBeNull();
    });

    it("returns null when no criteria have finite numeric bands", () => {
      const payload = {
        ...validPayload,
        criteria: {
          task_response: { band: "invalid", strengths_noted: "Good", rationale: "OK" },
        },
      };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).toBeNull();
    });

    it("returns null when weaknesses is not an array", () => {
      const payload = { ...validPayload, weaknesses: {} };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).toBeNull();
    });

    it("returns null when model_paragraph.original is missing", () => {
      const payload = {
        ...validPayload,
        model_paragraph: {
          ...validPayload.model_paragraph,
          original: undefined,
        },
      };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).toBeNull();
    });

    it("returns null when model_paragraph.rewrite is missing", () => {
      const payload = {
        ...validPayload,
        model_paragraph: {
          ...validPayload.model_paragraph,
          rewrite: undefined,
        },
      };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).toBeNull();
    });

    it("returns null when model_paragraph.original is not a string", () => {
      const payload = {
        ...validPayload,
        model_paragraph: {
          ...validPayload.model_paragraph,
          original: 123,
        },
      };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).toBeNull();
    });

    it("replaces invalid weakest_criterion with lowest-band criterion key", () => {
      // WHY: dashboard grouping depends on it being a valid CriterionKey
      const payload = {
        ...validPayload,
        weakest_criterion: "invalid_key",
      };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).not.toBeNull();
      // coherence_cohesion has band 6.0, task_response has 6.5, so weakest is coherence_cohesion
      expect(result?.weakest_criterion).toBe("coherence_cohesion");
    });

    it("coerces missing optional fields to defaults", () => {
      const payload = {
        ...validPayload,
        examiner_summary: undefined,
        model_paragraph: {
          original: "original",
          rewrite: "rewrite",
          // target_band, criterion_improved, changes_explained missing
        },
      };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).not.toBeNull();
      expect(result?.examiner_summary).toBe("");
      expect(result?.model_paragraph.target_band).toBe(8);
      expect(result?.model_paragraph.criterion_improved).toBe("");
      expect(result?.model_paragraph.changes_explained).toBe("");
    });

    it("filters weaknesses with missing or non-string required fields", () => {
      const payload = {
        ...validPayload,
        weaknesses: [
          {
            issue: "Valid issue",
            criterion: "coherence_cohesion",
            quoted_example: "example",
            explanation: "explanation",
            fix: "fix",
          },
          {
            issue: "",  // Empty issue, should be filtered
            criterion: "coherence_cohesion",
            quoted_example: "example",
            explanation: "explanation",
            fix: "fix",
          },
          {
            issue: "Another valid",
            criterion: "coherence_cohesion",
            quoted_example: "example",
            explanation: "explanation",
            fix: "fix",
          },
        ],
      };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).not.toBeNull();
      expect(result?.weaknesses.length).toBe(2);
    });

    it("filters vocabulary_upgrades with missing or non-string fields", () => {
      const payload = {
        ...validPayload,
        vocabulary_upgrades: [
          { original: "a", upgrade: "b", why: "reason" },
          { original: "c", upgrade: null, why: "reason" },  // invalid upgrade
          { original: "d", upgrade: "e", why: "reason" },
        ],
      };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).not.toBeNull();
      expect(result?.vocabulary_upgrades.length).toBe(2);
    });

    it("coerces vocabulary_upgrades to [] if not an array", () => {
      const payload = {
        ...validPayload,
        vocabulary_upgrades: undefined,
      };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).not.toBeNull();
      expect(result?.vocabulary_upgrades).toEqual([]);
    });

    it("clamps criterion bands to [1, 9]", () => {
      const payload = {
        ...validPayload,
        criteria: {
          task_response: { band: 15, strengths_noted: "Good", rationale: "OK" },
          coherence_cohesion: { band: -2, strengths_noted: "Bad", rationale: "OK" },
        },
      };
      const raw = JSON.stringify(payload);
      const result = parseScoringResult(raw);
      expect(result).not.toBeNull();
      expect(result?.criteria.task_response?.band).toBe(9);
      expect(result?.criteria.coherence_cohesion?.band).toBe(1);
    });
  });
});
