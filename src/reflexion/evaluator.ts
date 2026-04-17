import type { EvaluatorFunction } from './types.js';

/** Extracts the first number (including decimals) from text. */
export function extractNumber(text: string): number {
  const m = text.match(/-?\d+(?:\.\d+)?/);
  return m ? Number.parseFloat(m[0]) : Number.NaN;
}

/** Built-in evaluator: pass when output includes a substring from expected.fix */
export function createCodeFixEvaluator(): EvaluatorFunction {
  return async (output, expected) => {
    const fix =
      expected && typeof expected === 'object' && expected !== null && 'fix' in expected
        ? String((expected as { fix: unknown }).fix)
        : undefined;
    if (fix === undefined) {
      return { passed: false, reason: 'expected.fix is required for this evaluator' };
    }
    const noSyntaxError = !output.includes('SyntaxError');
    const containsFix = output.includes(fix);
    const passed = noSyntaxError && containsFix;
    return {
      passed,
      score: passed ? 1 : 0,
      reason: passed ? undefined : `Need substring "${fix}" and no SyntaxError (syntax ok: ${noSyntaxError})`,
    };
  };
}

/** Built-in evaluator: numeric answer within tolerance */
export function createMathEvaluator(tolerance = 0.001): EvaluatorFunction {
  return async (output, expected) => {
    const exp =
      expected && typeof expected === 'object' && expected !== null && 'answer' in expected
        ? Number((expected as { answer: unknown }).answer)
        : Number.NaN;
    if (Number.isNaN(exp)) {
      return { passed: false, reason: 'expected.answer (number) is required' };
    }
    const got = extractNumber(output);
    if (Number.isNaN(got)) {
      return { passed: false, reason: 'Could not parse a number from model output' };
    }
    const passed = Math.abs(got - exp) < tolerance;
    return {
      passed,
      reason: passed ? undefined : `Expected ${exp}, got ${got}`,
    };
  };
}

/** Pass when output is at least `minLength` characters (demo / smoke tests). */
export function createLenientEvaluator(minLength = 20): EvaluatorFunction {
  return async (output) => {
    const passed = output.trim().length >= minLength;
    return {
      passed,
      reason: passed ? undefined : `Need at least ${minLength} characters in the answer`,
    };
  };
}

/**
 * Uses `expected.fix` or `expected.answer` when present; otherwise length-based check.
 * Reuses one instance each of the code-fix, math, and lenient evaluators (no per-call allocation).
 */
export function createFlexibleEvaluator(minLenientLength = 25): EvaluatorFunction {
  const lenient = createLenientEvaluator(minLenientLength);
  const codeFix = createCodeFixEvaluator();
  const math = createMathEvaluator();
  return async (output, expected) => {
    if (expected && typeof expected === 'object' && expected !== null && 'fix' in expected) {
      return codeFix(output, expected);
    }
    if (expected && typeof expected === 'object' && expected !== null && 'answer' in expected) {
      return math(output, expected);
    }
    return lenient(output);
  };
}
