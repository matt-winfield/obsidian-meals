import moment from 'moment';
import { Err, Ok, type Result } from 'ts-results-es';
import { describe, expect, test } from 'vitest';
import { ShoppingListIgnoreBehaviour } from '../settings/settings.ts';
import {
    BehaviourValidationError,
    GetCurrentWeek,
    GetWeekDateFromMoment,
    validateIgnoreBehaviour,
    wildcardToRegex,
} from '../utils/utils.ts';

test('wildcardToRegex', () => {
    interface Test {
        input: string;
        expected: RegExp;
    }

    const tests: Test[] = [{ input: '*', expected: /^.*$/ }];

    for (const test of tests) {
        const actual = wildcardToRegex(test.input);

        expect(actual).toStrictEqual(test.expected);
    }
});

test('validateIgnoreBehaviour_ExactPartial', () => {
    const input = ['salt', 'pepper'];

    let res = validateIgnoreBehaviour(input, ShoppingListIgnoreBehaviour.Exact);

    expect(res.isOk());

    res = validateIgnoreBehaviour(input, ShoppingListIgnoreBehaviour.Exact);

    expect(res.isOk());
});

test('validateIgnoreBehaviour_Regex', () => {
    interface Test {
        input: string[];
        expected: Result<boolean, BehaviourValidationError>;
    }

    const tests: Test[] = [
        {
            input: ['salt.*', 'pepper'],
            expected: Ok(true),
        },
        {
            input: ['salt['],
            expected: Err(
                new BehaviourValidationError(
                    "Shopping list's ignore items are invalid: Invalid regular expression: /salt[/: Unterminated character class.",
                ),
            ),
        },
    ];

    for (const test of tests) {
        const actual = validateIgnoreBehaviour(test.input, ShoppingListIgnoreBehaviour.Regex);

        if (test.expected.isOk()) {
            expect(actual).toStrictEqual(test.expected);
        } else {
            expect(actual.unwrapErr().message).toStrictEqual(test.expected.unwrapErr().message);
        }
    }
});

test('validateIgnoreBehaviour_Wildcard', () => {
    interface Test {
        input: string[];
        expected: Result<boolean, BehaviourValidationError>;
    }

    const tests: Test[] = [
        {
            input: ['salt*', 'pepper'],
            expected: Ok(true),
        },
        {
            input: ['salt['],
            expected: Err(
                new BehaviourValidationError(
                    "Shopping list's ignore items are invalid: Invalid regular expression: /salt[/: Unterminated character class.",
                ),
            ),
        },
    ];

    for (const test of tests) {
        const actual = validateIgnoreBehaviour(test.input, ShoppingListIgnoreBehaviour.Regex);

        if (test.expected.isOk()) {
            expect(actual).toStrictEqual(test.expected);
        } else {
            expect(actual.unwrapErr().message).toStrictEqual(test.expected.unwrapErr().message);
        }
    }
});

describe('GetWeekDateFromMoment', () => {
    test('returns correct week start for Sunday when startOfWeek is Monday', () => {
        // Sunday January 25th, 2026 - should return Monday January 19th (the Monday of that week)
        const date = moment('2026-01-25'); // Sunday
        const startOfWeek = 1; // Monday

        const result = GetWeekDateFromMoment(date, startOfWeek);

        expect(result).toBe('January 19th');
    });

    test('returns correct week start for Monday when startOfWeek is Monday', () => {
        // Monday January 19th, 2026 - should return January 19th
        const date = moment('2026-01-19'); // Monday
        const startOfWeek = 1; // Monday

        const result = GetWeekDateFromMoment(date, startOfWeek);

        expect(result).toBe('January 19th');
    });

    test('returns correct week start for Saturday when startOfWeek is Monday', () => {
        // Saturday January 24th, 2026 - should return Monday January 19th
        const date = moment('2026-01-24'); // Saturday
        const startOfWeek = 1; // Monday

        const result = GetWeekDateFromMoment(date, startOfWeek);

        expect(result).toBe('January 19th');
    });

    test('returns correct week start for Sunday when startOfWeek is Sunday', () => {
        // Sunday January 25th, 2026 - should return January 25th (the Sunday itself)
        const date = moment('2026-01-25'); // Sunday
        const startOfWeek = 0; // Sunday

        const result = GetWeekDateFromMoment(date, startOfWeek);

        expect(result).toBe('January 25th');
    });

    test('returns correct week start for Monday when startOfWeek is Sunday', () => {
        // Monday January 26th, 2026 - should return Sunday January 25th
        const date = moment('2026-01-26'); // Monday
        const startOfWeek = 0; // Sunday

        const result = GetWeekDateFromMoment(date, startOfWeek);

        expect(result).toBe('January 25th');
    });

    test('returns correct week start for Saturday when startOfWeek is Sunday', () => {
        // Saturday January 31st, 2026 - should return Sunday January 25th
        const date = moment('2026-01-31'); // Saturday
        const startOfWeek = 0; // Sunday

        const result = GetWeekDateFromMoment(date, startOfWeek);

        expect(result).toBe('January 25th');
    });
});
