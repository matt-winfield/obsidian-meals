import moment from 'moment';
import { Err, Ok, type Result } from 'ts-results-es';
import { ShoppingListIgnoreBehaviour } from '../settings/settings.ts';

/**
 * Calculate the start of the week for the current date.
 * Uses day() (0=Sunday, 6=Saturday) instead of weekday() to avoid locale-dependent behavior.
 */
export function GetCurrentWeek(startOfWeek: number) {
    const today = moment();
    const dayOfWeek = today.day();
    const daysFromStart = (dayOfWeek - startOfWeek + 7) % 7;
    return today.clone().subtract(daysFromStart, 'days').format('MMMM Do');
}

/**
 * Calculate the start of the week for a given date.
 * Uses day() (0=Sunday, 6=Saturday) instead of weekday() to avoid locale-dependent behavior.
 */
export function GetWeekDateFromMoment(date: moment.Moment, startOfWeek: number) {
    const dayOfWeek = date.day();
    const daysFromStart = (dayOfWeek - startOfWeek + 7) % 7;
    return date.clone().subtract(daysFromStart, 'days').format('MMMM Do');
}

/**
 * Get the week start date as a moment object.
 * Uses day() (0=Sunday, 6=Saturday) instead of weekday() to avoid locale-dependent behavior.
 */
export function getWeekStartMoment(date: moment.Moment, startOfWeek: number): moment.Moment {
    const dayOfWeek = date.day();
    const daysFromStart = (dayOfWeek - startOfWeek + 7) % 7;
    return date.clone().subtract(daysFromStart, 'days');
}

// https://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format#4673436
export function formatUnicorn(fmtString: string, obj: object) {
    let str = fmtString;

    for (const [key, rawValue] of Object.entries(obj)) {
        let value = rawValue;
        if (rawValue == null) {
            value = '';
        }
        str = str.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
    }

    return str;
}

export function wildcardToRegex(pattern: string): RegExp {
    const escaped = pattern
        .replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&') // Escape regex special chars
        .replace(/\*/g, '.*'); // Convert wildcard '*' to '.*'
    return new RegExp(`^${escaped}$`);
}

export class BehaviourValidationError {
    message = '';

    constructor(message: string) {
        this.message = message;
    }
}

export function validateIgnoreBehaviour(
    ignoreList: string[],
    behaviour: ShoppingListIgnoreBehaviour,
): Result<boolean, BehaviourValidationError> {
    // Nothing to validate here
    if (behaviour === ShoppingListIgnoreBehaviour.Exact || behaviour === ShoppingListIgnoreBehaviour.Partial) {
        return Ok(true);
    }

    for (const item of ignoreList) {
        try {
            if (behaviour === ShoppingListIgnoreBehaviour.Wildcard) {
                new RegExp(wildcardToRegex(item));
            } else {
                new RegExp(item);
            }
        } catch (e) {
            return Err(new BehaviourValidationError(`Shopping list's ignore items are invalid: ${(<Error>e).message}.`));
        }
    }

    return Ok(true);
}
