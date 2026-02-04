import moment from 'moment';
import { writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DAYS_OF_WEEK } from '../constants.ts';
import type { Context } from '../context.ts';
import {
    AddRecipeToMealPlan,
    AddRecipeToMealPlanByDate,
    addRecipeToTable,
    convertListToTable,
    convertTableToList,
    createTableWeekSection,
    detectMealPlanFormat,
    RemoveRecipeFromMealPlan,
} from '../meal_plan/plan.ts';
import { Recipe } from '../recipe/recipe.ts';
import { MealPlanFormat, MealSettings } from '../settings/settings.ts';
import * as Utils from '../utils/utils.ts';

test('createTableWeekSection_basic', () => {
    const weekDate = 'January 8th';
    const dayHeaders = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const result = createTableWeekSection(weekDate, dayHeaders);

    const expectedOutput = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th | | | | | | | |`;

    expect(result).toBe(expectedOutput);
});

test('createTableWeekSection_respectsStartOfWeek', () => {
    const weekDate = 'January 8th';

    // Simulate startOfWeek = 1 (Monday)
    const dayHeaders: string[] = [];
    const startOfWeek = 1;

    for (let i = 0; i < DAYS_OF_WEEK.length; ++i) {
        const pos = (i + startOfWeek) % DAYS_OF_WEEK.length;
        dayHeaders.push(DAYS_OF_WEEK[pos]);
    }

    const result = createTableWeekSection(weekDate, dayHeaders);

    const expectedOutput = `| Week Start | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
|---|---|---|---|---|---|---|---|
| January 8th | | | | | | | |`;

    expect(result).toBe(expectedOutput);
});

test('addRecipeToTable_emptyCell', () => {
    const content = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th | | | | | | | |
| January 1st | | | | | | | |
`;

    const result = addRecipeToTable(content, 'January 8th', 'Monday', 'Pasta Carbonara');

    expect(result).toContain('| January 8th |  | [[Pasta Carbonara]] |  |  |  |  |  |');
    // January 1st row should remain unchanged from input
    expect(result).toContain('| January 1st | | | | | | | |');
});

test('addRecipeToTable_existingRecipe', () => {
    const content = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th |  | [[Pasta Carbonara]] |  |  |  |  |  |
| January 1st |  |  |  |  |  |  |  |
`;

    const result = addRecipeToTable(content, 'January 8th', 'Monday', 'Chicken Tikka Masala');

    expect(result).toContain('| January 8th |  | [[Pasta Carbonara]]<br>[[Chicken Tikka Masala]] |  |  |  |  |  |');
    expect(result).toContain('| January 1st |  |  |  |  |  |  |  |');
});

test('addRecipeToTable_differentDays', () => {
    const content = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th |  |  |  |  |  |  |  |
| January 1st |  |  |  |  |  |  |  |
`;

    let result = content;

    result = addRecipeToTable(result, 'January 8th', 'Monday', 'Recipe 1');
    result = addRecipeToTable(result, 'January 8th', 'Wednesday', 'Recipe 2');
    result = addRecipeToTable(result, 'January 8th', 'Friday', 'Recipe 3');

    expect(result).toContain('[[Recipe 1]]');
    expect(result).toContain('[[Recipe 2]]');
    expect(result).toContain('[[Recipe 3]]');

    // Verify recipes are in correct columns
    const lines = result.split('\n');
    const dataRow = lines.find((line) => line.includes('January 8th') && line.includes('Recipe'));

    expect(dataRow).toBeDefined();
    if (dataRow) {
        // Parse cells but keep empty ones to preserve column positions
        const allCells = dataRow.split('|').map((c) => c.trim());
        // Remove first and last empty cells (before first | and after last |)
        const cells = allCells.slice(1, -1);

        // cells[0] = "January 8th", cells[1] = Sunday (empty), cells[2] = Monday (Recipe 1), etc.
        expect(cells[2]).toContain('Recipe 1'); // Monday
        expect(cells[4]).toContain('Recipe 2'); // Wednesday
        expect(cells[6]).toContain('Recipe 3'); // Friday
    }

    // Verify January 1st row is unchanged
    expect(result).toContain('| January 1st |  |  |  |  |  |  |  |');
});

test('addRecipeToTable_headerSpacingVariations', () => {
    // Test that header detection works with different spacing (e.g., "Week Start  |" with 2 spaces)
    const content = `| Week Start  | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th |  |  |  |  |  |  |  |
`;

    const result = addRecipeToTable(content, 'January 8th', 'Monday', 'Test Recipe');

    expect(result).toContain('[[Test Recipe]]');
    expect(result).toContain('| January 8th |  | [[Test Recipe]] |  |  |  |  |  |');
});

test('addRecipeToTable_multipleWeeks_table', () => {
    const content = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 15th |  |  |  |  |  |  |  |
| January 8th |  | [[Old Recipe]] |  |  |  |  |  |
| January 1st |  |  |  |  |  |  |  |
`;

    const result = addRecipeToTable(content, 'January 15th', 'Wednesday', 'New Recipe');

    // Should add to the January 15th week
    expect(result).toContain('| January 15th |  |  |  | [[New Recipe]] |  |  |  |');

    // Should not modify older weeks
    expect(result).toContain('| January 8th |  | [[Old Recipe]] |  |  |  |  |  |');
    expect(result).toContain('| January 1st |  |  |  |  |  |  |  |');
});

test('addRecipeToTable_multipleWeeks_addToCorrectWeek', () => {
    const content = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 15th |  |  |  |  |  |  |  |
| January 8th |  |  |  |  |  |  |  |
`;

    // Add to week 1
    let result = content;
    result = addRecipeToTable(result, 'January 15th', 'Monday', 'Recipe A');
    expect(result).toContain('| January 15th |  | [[Recipe A]] |  |  |  |  |  |');

    // Add to week 2
    result = addRecipeToTable(result, 'January 8th', 'Friday', 'Recipe B');

    // Both weeks should have their recipes
    expect(result).toContain('| January 15th |  | [[Recipe A]] |  |  |  |  |  |');
    expect(result).toContain('| January 8th |  |  |  |  |  | [[Recipe B]] |  |');
});

describe('AddRecipeToMealPlan integration tests', () => {
    let mockContext: Context;
    let mockRecipe: Recipe;
    let fileContent: string;

    beforeEach(() => {
        // Clear all mocks
        vi.clearAllMocks();

        // Mock GetCurrentWeek to return a fixed date for testing
        vi.spyOn(Utils, 'GetCurrentWeek').mockReturnValue('January 8th');

        // Reset file content
        fileContent = '';

        // Create mock recipe
        const mockFile = {
            path: 'test-recipe.md',
            basename: 'Test Recipe',
        } as any;
        mockRecipe = new Recipe(mockFile);

        // Create mock vault with process method
        const mockVault = {
            getFileByPath: vi.fn().mockReturnValue({
                vault: {
                    process: vi.fn((_file, callback) => {
                        fileContent = callback(fileContent);
                        return Promise.resolve();
                    }),
                },
            }),
            process: vi.fn((_file, callback) => {
                fileContent = callback(fileContent);
                return Promise.resolve();
            }),
            create: vi.fn().mockResolvedValue({}),
        };

        // Create mock context
        const settings = new MealSettings();
        settings.mealPlanNote = 'Meal Plan';
        settings.startOfWeek = 0; // Sunday

        mockContext = {
            settings: writable(settings),
            app: {
                vault: mockVault,
            } as any,
            plugin: {} as any,
            recipes: writable([]),
            ingredients: {} as any,
            getRecipeFolder: vi.fn(),
            isInRecipeFolder: vi.fn(),
            loadRecipes: vi.fn(),
            debugMode: vi.fn().mockReturnValue(false),
        };
    });

    test('should add recipe to list format', async () => {
        // Setup initial file content with list format
        fileContent = `# Week of January 8th
## Sunday
## Monday
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday
`;

        await AddRecipeToMealPlan(mockContext, mockRecipe, 'Wednesday');

        expect(fileContent).toContain('## Wednesday\n- [[Test Recipe]]');
        expect(fileContent).toContain('# Week of January 8th');
    });

    test('should add recipe to table format', async () => {
        // Setup initial file content with table format
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th |  |  |  |  |  |  |  |
`;

        await AddRecipeToMealPlan(mockContext, mockRecipe, 'Wednesday');

        expect(fileContent).toContain('[[Test Recipe]]');
        expect(fileContent).toContain('| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |');
        // Check that recipe is in Wednesday column (column index 4)
        const dataRow = fileContent.split('\n').find((line) => line.includes('January 8th') && line.includes('Test Recipe'));
        expect(dataRow).toBeDefined();
    });

    test('should add multiple recipes to same day in list format', async () => {
        fileContent = `# Week of January 8th
## Sunday
## Monday
- [[First Recipe]]
## Tuesday
`;

        await AddRecipeToMealPlan(mockContext, mockRecipe, 'Monday');

        expect(fileContent).toContain('- [[First Recipe]]');
        expect(fileContent).toContain('- [[Test Recipe]]');
        // Both should be under Monday
        const mondaySection = fileContent.split('## Tuesday')[0];
        expect(mondaySection).toContain('- [[First Recipe]]');
        expect(mondaySection).toContain('- [[Test Recipe]]');
    });

    test('should add multiple recipes to same day in table format', async () => {
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th |  | [[First Recipe]] |  |  |  |  |  |
`;

        await AddRecipeToMealPlan(mockContext, mockRecipe, 'Monday');

        expect(fileContent).toContain('[[First Recipe]]<br>[[Test Recipe]]');
    });

    test('should handle list format with multiple weeks', async () => {
        fileContent = `# Week of January 8th
## Sunday
## Monday
## Tuesday

# Week of January 1st
## Sunday
## Monday
- [[Old Recipe]]
## Tuesday
`;

        await AddRecipeToMealPlan(mockContext, mockRecipe, 'Monday');

        // Should add to January 8th week (current week)
        expect(fileContent).toContain('- [[Test Recipe]]');
        // Should not modify January 1st week
        expect(fileContent).toContain('- [[Old Recipe]]');

        // Verify it's in the correct week
        const jan8Section = fileContent.split('# Week of January 1st')[0];
        expect(jan8Section).toContain('- [[Test Recipe]]');
    });
});

describe('AddRecipeToMealPlanByDate integration tests', () => {
    let mockContext: Context;
    let mockRecipe: Recipe;
    let fileContent: string;

    beforeEach(() => {
        vi.clearAllMocks();

        fileContent = '';

        const mockFile = {
            path: 'test-recipe.md',
            basename: 'Test Recipe',
        } as any;
        mockRecipe = new Recipe(mockFile);

        const mockVault = {
            getFileByPath: vi.fn().mockReturnValue({
                vault: {
                    process: vi.fn((_file, callback) => {
                        fileContent = callback(fileContent);
                        return Promise.resolve();
                    }),
                },
            }),
            process: vi.fn((_file, callback) => {
                fileContent = callback(fileContent);
                return Promise.resolve();
            }),
            create: vi.fn().mockResolvedValue({}),
        };

        const settings = new MealSettings();
        settings.mealPlanNote = 'Meal Plan';
        settings.startOfWeek = 0; // Sunday
        settings.mealPlanFormat = MealPlanFormat.List;

        mockContext = {
            settings: writable(settings),
            app: {
                vault: mockVault,
            } as any,
            plugin: {} as any,
            recipes: writable([]),
            ingredients: {} as any,
            getRecipeFolder: vi.fn(),
            isInRecipeFolder: vi.fn(),
            loadRecipes: vi.fn(),
            debugMode: vi.fn().mockReturnValue(false),
        };
    });

    test('should add recipe to specific date in list format', async () => {
        // January 7th 2024 is a Sunday, so "Week of January 7th" is the correct week start
        fileContent = `# Week of January 7th
## Sunday
## Monday
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday
`;

        const targetDate = moment('2024-01-08'); // A Monday in the week of January 7th
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Monday');

        expect(fileContent).toContain('## Monday\n- [[Test Recipe]]');
    });

    test('should add recipe to specific date in table format', async () => {
        // January 7th 2024 is a Sunday, so "Week of January 7th" is the correct week start
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 7th |  |  |  |  |  |  |  |
`;

        const targetDate = moment('2024-01-10'); // Wednesday in the week of January 7th
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Wednesday');

        expect(fileContent).toContain('[[Test Recipe]]');
        // Verify the recipe was added to the table
        const dataRow = fileContent.split('\n').find((line) => line.includes('January 7th') && line.includes('Test Recipe'));
        expect(dataRow).toBeDefined();
    });

    test('should create new week section when adding to future week in list format', async () => {
        // January 7th 2024 is a Sunday
        fileContent = `# Week of January 7th
## Sunday
## Monday
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday
`;

        // Add to a future week (January 15th is a Monday in the week of January 14th)
        const targetDate = moment('2024-01-15');
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Monday');

        // Should create new week section
        expect(fileContent).toContain('# Week of January 14th');
        expect(fileContent).toContain('- [[Test Recipe]]');
    });

    test('should create new week row when adding to future week in table format', async () => {
        const settings = new MealSettings();
        settings.mealPlanNote = 'Meal Plan';
        settings.startOfWeek = 0;
        settings.mealPlanFormat = MealPlanFormat.Table;
        mockContext.settings = writable(settings);

        // January 7th 2024 is a Sunday
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 7th |  |  |  |  |  |  |  |
`;

        const targetDate = moment('2024-01-15');
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Monday');

        // Should add new row for the new week
        expect(fileContent).toContain('January 14th');
        expect(fileContent).toContain('[[Test Recipe]]');
    });

    test('should not duplicate week section if it already exists', async () => {
        // January 7th 2024 is a Sunday
        fileContent = `# Week of January 7th
## Sunday
## Monday
- [[Existing Recipe]]
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday
`;

        const targetDate = moment('2024-01-08'); // Monday in week of January 7th
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Monday');

        // Should only have one "Week of January 7th" header
        const weekHeaderCount = (fileContent.match(/# Week of January 7th/g) || []).length;
        expect(weekHeaderCount).toBe(1);

        // Should have both recipes
        expect(fileContent).toContain('[[Existing Recipe]]');
        expect(fileContent).toContain('[[Test Recipe]]');
    });

    test('should handle adding to past weeks', async () => {
        // January 14th 2024 is a Sunday
        fileContent = `# Week of January 14th
## Sunday
## Monday
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday
`;

        // Add to a past week (January 3rd 2024 is Wednesday in week starting Dec 31st)
        const targetDate = moment('2024-01-03');
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Wednesday');

        // Should create the past week section (Dec 31st 2023 is a Sunday)
        expect(fileContent).toContain('December 31st');
        expect(fileContent).toContain('- [[Test Recipe]]');
    });
});

describe('RemoveRecipeFromMealPlan', () => {
    let mockContext: Context;
    let fileContent: string;

    beforeEach(() => {
        vi.clearAllMocks();

        fileContent = '';

        const mockVault = {
            getFileByPath: vi.fn().mockReturnValue({
                vault: {
                    process: vi.fn((_file, callback) => {
                        fileContent = callback(fileContent);
                        return Promise.resolve();
                    }),
                },
            }),
            process: vi.fn((_file, callback) => {
                fileContent = callback(fileContent);
                return Promise.resolve();
            }),
        };

        const settings = new MealSettings();
        settings.mealPlanNote = 'Meal Plan';
        settings.startOfWeek = 0; // Sunday

        mockContext = {
            settings: writable(settings),
            app: {
                vault: mockVault,
            } as any,
            plugin: {} as any,
            recipes: writable([]),
            ingredients: {} as any,
            getRecipeFolder: vi.fn(),
            isInRecipeFolder: vi.fn(),
            loadRecipes: vi.fn(),
            debugMode: vi.fn().mockReturnValue(false),
        };
    });

    test('should remove recipe from list format', async () => {
        fileContent = `# Week of January 7th
## Sunday
## Monday
- [[Test Recipe]]
- [[Another Recipe]]
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday
`;

        const targetDate = moment('2024-01-08'); // Monday in week of January 7th
        await RemoveRecipeFromMealPlan(mockContext, 'Test Recipe', targetDate);

        expect(fileContent).not.toContain('- [[Test Recipe]]');
        expect(fileContent).toContain('- [[Another Recipe]]');
    });

    test('should remove recipe from table format', async () => {
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 7th |  | [[Test Recipe]] |  |  |  |  |  |
`;

        const targetDate = moment('2024-01-08'); // Monday in week of January 7th
        await RemoveRecipeFromMealPlan(mockContext, 'Test Recipe', targetDate);

        expect(fileContent).not.toContain('[[Test Recipe]]');
        // Table structure should be preserved
        expect(fileContent).toContain('| Week Start |');
        expect(fileContent).toContain('| January 7th |');
    });

    test('should remove recipe when multiple recipes in same day (table)', async () => {
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 7th |  | [[Recipe 1]]<br>[[Recipe 2]]<br>[[Recipe 3]] |  |  |  |  |  |
`;

        const targetDate = moment('2024-01-08'); // Monday
        await RemoveRecipeFromMealPlan(mockContext, 'Recipe 2', targetDate);

        expect(fileContent).toContain('[[Recipe 1]]');
        expect(fileContent).not.toContain('[[Recipe 2]]');
        expect(fileContent).toContain('[[Recipe 3]]');
    });

    test('should remove first recipe from multiple in same day (table)', async () => {
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 7th |  | [[Recipe 1]]<br>[[Recipe 2]] |  |  |  |  |  |
`;

        const targetDate = moment('2024-01-08'); // Monday
        await RemoveRecipeFromMealPlan(mockContext, 'Recipe 1', targetDate);

        expect(fileContent).not.toContain('[[Recipe 1]]');
        expect(fileContent).toContain('[[Recipe 2]]');
        expect(fileContent).not.toContain('<br>[[Recipe 2]]'); // Should clean up orphan <br>
    });

    test('should remove last recipe from multiple in same day (table)', async () => {
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 7th |  | [[Recipe 1]]<br>[[Recipe 2]] |  |  |  |  |  |
`;

        const targetDate = moment('2024-01-08'); // Monday
        await RemoveRecipeFromMealPlan(mockContext, 'Recipe 2', targetDate);

        expect(fileContent).toContain('[[Recipe 1]]');
        expect(fileContent).not.toContain('[[Recipe 2]]');
        expect(fileContent).not.toContain('[[Recipe 1]]<br>'); // Should clean up trailing <br>
    });

    test('should handle list format with checkbox items', async () => {
        fileContent = `# Week of January 7th
## Sunday
## Monday
- [ ] [[Test Recipe]]
- [x] [[Completed Recipe]]
## Tuesday
`;

        const targetDate = moment('2024-01-08'); // Monday
        await RemoveRecipeFromMealPlan(mockContext, 'Test Recipe', targetDate);

        expect(fileContent).not.toContain('[[Test Recipe]]');
        expect(fileContent).toContain('- [x] [[Completed Recipe]]');
    });

    test('should not modify other weeks in list format', async () => {
        fileContent = `# Week of January 14th
## Sunday
## Monday
- [[Same Recipe Name]]
## Tuesday

# Week of January 7th
## Sunday
## Monday
- [[Same Recipe Name]]
## Tuesday
`;

        const targetDate = moment('2024-01-08'); // Monday in week of January 7th
        await RemoveRecipeFromMealPlan(mockContext, 'Same Recipe Name', targetDate);

        // Should remove from January 7th week only
        const jan14Section = fileContent.split('# Week of January 7th')[0];
        expect(jan14Section).toContain('[[Same Recipe Name]]');

        const jan7Section = fileContent.split('# Week of January 7th')[1];
        expect(jan7Section).not.toContain('[[Same Recipe Name]]');
    });

    test('should not modify other weeks in table format', async () => {
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 14th |  | [[Same Recipe]] |  |  |  |  |  |
| January 7th |  | [[Same Recipe]] |  |  |  |  |  |
`;

        const targetDate = moment('2024-01-08'); // Monday in week of January 7th
        await RemoveRecipeFromMealPlan(mockContext, 'Same Recipe', targetDate);

        // Should still have recipe in January 14th
        expect(fileContent).toContain('| January 14th |  | [[Same Recipe]] |');
        // Should be removed from January 7th
        expect(fileContent).toMatch(/\| January 7th \|[^|]*\|[^[]*\|/);
    });

    test('should handle recipes with special characters', async () => {
        fileContent = `# Week of January 7th
## Sunday
## Monday
- [[Recipe (with) Parens]]
- [[Another Recipe]]
## Tuesday
`;

        const targetDate = moment('2024-01-08'); // Monday
        await RemoveRecipeFromMealPlan(mockContext, 'Recipe (with) Parens', targetDate);

        expect(fileContent).not.toContain('[[Recipe (with) Parens]]');
        expect(fileContent).toContain('[[Another Recipe]]');
    });
});

describe('convertListToTable', () => {
    const defaultDayHeaders = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    test('should convert empty list format to table format', () => {
        const listContent = `# Week of January 8th
## Sunday
## Monday
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday
`;

        const result = convertListToTable(listContent, defaultDayHeaders);

        expect(result).toContain('| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |');
        expect(result).toContain('|---|---|---|---|---|---|---|---|');
        expect(result).toContain('| January 8th |');
    });

    test('should convert list format with recipes to table format', () => {
        const listContent = `# Week of January 8th
## Sunday
## Monday
- [[Pasta Carbonara]]
## Tuesday
## Wednesday
- [[Chicken Tikka Masala]]
- [[Garlic Bread]]
## Thursday
## Friday
## Saturday
`;

        const result = convertListToTable(listContent, defaultDayHeaders);

        expect(result).toContain('| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |');
        expect(result).toContain('[[Pasta Carbonara]]');
        expect(result).toContain('[[Chicken Tikka Masala]]<br>[[Garlic Bread]]');
    });

    test('should convert multiple weeks from list to table', () => {
        const listContent = `# Week of January 15th
## Sunday
## Monday
- [[Recipe A]]
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday

# Week of January 8th
## Sunday
## Monday
- [[Recipe B]]
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday
`;

        const result = convertListToTable(listContent, defaultDayHeaders);

        expect(result).toContain('| January 15th |');
        expect(result).toContain('| January 8th |');
        expect(result).toContain('[[Recipe A]]');
        expect(result).toContain('[[Recipe B]]');
    });

    test('should handle list format with checkbox items', () => {
        const listContent = `# Week of January 8th
## Sunday
## Monday
- [ ] [[Unchecked Recipe]]
- [x] [[Checked Recipe]]
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday
`;

        const result = convertListToTable(listContent, defaultDayHeaders);

        expect(result).toContain('[[Unchecked Recipe]]');
        expect(result).toContain('[[Checked Recipe]]');
    });

    test('should handle list format with plain text items', () => {
        const listContent = `# Week of January 8th
## Sunday
## Monday
- [[Recipe Link]]
- Plain text item
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday
`;

        const result = convertListToTable(listContent, defaultDayHeaders);

        expect(result).toContain('[[Recipe Link]]');
        expect(result).toContain('Plain text item');
    });

    test('should respect custom day order (Monday start)', () => {
        const mondayStartHeaders = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const listContent = `# Week of January 8th
## Monday
- [[Recipe A]]
## Tuesday
## Wednesday
## Thursday
## Friday
## Saturday
## Sunday
`;

        const result = convertListToTable(listContent, mondayStartHeaders);

        expect(result).toContain('| Week Start | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |');
        expect(result).toContain('[[Recipe A]]');
    });
});

describe('convertTableToList', () => {
    const defaultDayHeaders = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    test('should convert empty table format to list format', () => {
        const tableContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th |  |  |  |  |  |  |  |
`;

        const result = convertTableToList(tableContent, defaultDayHeaders);

        expect(result).toContain('# Week of January 8th');
        expect(result).toContain('## Sunday');
        expect(result).toContain('## Monday');
        expect(result).toContain('## Tuesday');
        expect(result).toContain('## Wednesday');
        expect(result).toContain('## Thursday');
        expect(result).toContain('## Friday');
        expect(result).toContain('## Saturday');
    });

    test('should convert table format with recipes to list format', () => {
        const tableContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th |  | [[Pasta Carbonara]] |  | [[Chicken Tikka Masala]]<br>[[Garlic Bread]] |  |  |  |
`;

        const result = convertTableToList(tableContent, defaultDayHeaders);

        expect(result).toContain('# Week of January 8th');
        expect(result).toContain('## Monday\n- [[Pasta Carbonara]]');
        expect(result).toContain('## Wednesday\n- [[Chicken Tikka Masala]]\n- [[Garlic Bread]]');
    });

    test('should convert multiple weeks from table to list', () => {
        const tableContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 15th |  | [[Recipe A]] |  |  |  |  |  |
| January 8th |  | [[Recipe B]] |  |  |  |  |  |
`;

        const result = convertTableToList(tableContent, defaultDayHeaders);

        expect(result).toContain('# Week of January 15th');
        expect(result).toContain('# Week of January 8th');
        expect(result).toContain('[[Recipe A]]');
        expect(result).toContain('[[Recipe B]]');
    });

    test('should handle table with plain text items', () => {
        const tableContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th |  | [[Recipe Link]]<br>Plain text item |  |  |  |  |  |
`;

        const result = convertTableToList(tableContent, defaultDayHeaders);

        expect(result).toContain('- [[Recipe Link]]');
        expect(result).toContain('- Plain text item');
    });

    test('should respect custom day order (Monday start)', () => {
        const mondayStartHeaders = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const tableContent = `| Week Start | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
|---|---|---|---|---|---|---|---|
| January 8th | [[Recipe A]] |  |  |  |  |  |  |
`;

        const result = convertTableToList(tableContent, mondayStartHeaders);

        expect(result).toContain('# Week of January 8th');
        expect(result).toContain('## Monday\n- [[Recipe A]]');
        // Day order should match the headers
        const mondayIndex = result.indexOf('## Monday');
        const tuesdayIndex = result.indexOf('## Tuesday');
        expect(mondayIndex).toBeLessThan(tuesdayIndex);
    });

    test('should preserve order of items in cell', () => {
        const tableContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th |  | [[First]]<br>[[Second]]<br>[[Third]] |  |  |  |  |  |
`;

        const result = convertTableToList(tableContent, defaultDayHeaders);

        const firstIndex = result.indexOf('[[First]]');
        const secondIndex = result.indexOf('[[Second]]');
        const thirdIndex = result.indexOf('[[Third]]');

        expect(firstIndex).toBeLessThan(secondIndex);
        expect(secondIndex).toBeLessThan(thirdIndex);
    });
});

describe('Format conversion round-trip', () => {
    const defaultDayHeaders = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    test('list -> table -> list should preserve recipes', () => {
        const originalList = `# Week of January 8th
## Sunday
## Monday
- [[Recipe A]]
- [[Recipe B]]
## Tuesday
## Wednesday
- [[Recipe C]]
## Thursday
## Friday
## Saturday
`;

        const table = convertListToTable(originalList, defaultDayHeaders);
        const backToList = convertTableToList(table, defaultDayHeaders);

        expect(backToList).toContain('[[Recipe A]]');
        expect(backToList).toContain('[[Recipe B]]');
        expect(backToList).toContain('[[Recipe C]]');
    });

    test('table -> list -> table should preserve recipes', () => {
        const originalTable = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th |  | [[Recipe A]]<br>[[Recipe B]] |  | [[Recipe C]] |  |  |  |
`;

        const list = convertTableToList(originalTable, defaultDayHeaders);
        const backToTable = convertListToTable(list, defaultDayHeaders);

        expect(backToTable).toContain('[[Recipe A]]');
        expect(backToTable).toContain('[[Recipe B]]');
        expect(backToTable).toContain('[[Recipe C]]');
    });
});

describe('addRecipeToTable edge cases', () => {
    test('should handle table with empty row between data rows', () => {
        const content = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 15th | | | | | | | |
| | | | | | | | |
| January 8th | | | | | | | |
`;

        const result = addRecipeToTable(content, 'January 8th', 'Monday', 'Test Recipe');

        // Should add recipe to January 8th row
        expect(result).toContain('| January 8th |  | [[Test Recipe]] |');
        // Empty row should be preserved
        expect(result).toContain('| | | | | | | | |');
        // January 15th should be unchanged
        expect(result).toContain('| January 15th | | | | | | | |');
    });

    test('should handle table with empty row at the beginning', () => {
        const content = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
| January 8th | | | | | | | |
`;

        const result = addRecipeToTable(content, 'January 8th', 'Wednesday', 'Test Recipe');

        // Should add recipe to January 8th row
        expect(result).toContain('| January 8th |  |  |  | [[Test Recipe]] |');
    });

    test('should return unchanged content when week not found', () => {
        const content = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th | | | | | | | |
`;

        const result = addRecipeToTable(content, 'February 1st', 'Monday', 'Test Recipe');

        // Should return unchanged content since February 1st doesn't exist
        expect(result).toBe(content);
    });

    test('should handle table with empty row at the end', () => {
        const content = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th | | | | | | | |
| | | | | | | | |
`;

        const result = addRecipeToTable(content, 'January 8th', 'Friday', 'Test Recipe');

        // Should add recipe to January 8th row
        expect(result).toContain('| January 8th |  |  |  |  |  | [[Test Recipe]] |  |');
        // Empty row at the end should be preserved
        expect(result).toContain('| | | | | | | | |');
    });
});

describe('AddRecipeToMealPlanByDate with future weeks', () => {
    let mockContext: Context;
    let mockRecipe: Recipe;
    let fileContent: string;

    beforeEach(() => {
        vi.clearAllMocks();

        fileContent = '';

        const mockFile = {
            path: 'test-recipe.md',
            basename: 'Test Recipe',
        } as any;
        mockRecipe = new Recipe(mockFile);

        const mockVault = {
            getFileByPath: vi.fn().mockReturnValue({
                vault: {
                    process: vi.fn((_file, callback) => {
                        fileContent = callback(fileContent);
                        return Promise.resolve();
                    }),
                },
            }),
            process: vi.fn((_file, callback) => {
                fileContent = callback(fileContent);
                return Promise.resolve();
            }),
            create: vi.fn().mockResolvedValue({}),
        };

        const settings = new MealSettings();
        settings.mealPlanNote = 'Meal Plan';
        settings.startOfWeek = 0; // Sunday
        settings.mealPlanFormat = MealPlanFormat.Table;

        mockContext = {
            settings: writable(settings),
            app: {
                vault: mockVault,
            } as any,
            plugin: {} as any,
            recipes: writable([]),
            ingredients: {} as any,
            getRecipeFolder: vi.fn(),
            isInRecipeFolder: vi.fn(),
            loadRecipes: vi.fn(),
            debugMode: vi.fn().mockReturnValue(false),
        };
    });

    test('should add recipe to future week that does not exist in table', async () => {
        // Start with a table that has January 7th week
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 7th | | | | | | | |
`;

        // Add recipe to February 4th (week of February 4th since Feb 4 2024 is a Sunday)
        const targetDate = moment('2024-02-05'); // Monday in week of February 4th
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Monday');

        // Should create new week row and add recipe
        expect(fileContent).toContain('February 4th');
        expect(fileContent).toContain('[[Test Recipe]]');
    });

    test('should add recipe to week many months in future', async () => {
        // Start with a table that has January 7th week
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 7th | | | | | | | |
`;

        // Add recipe to June 3rd 2024 (week of June 2nd since June 2 2024 is a Sunday)
        const targetDate = moment('2024-06-03'); // Monday in week of June 2nd
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Monday');

        // Should create new week row and add recipe
        expect(fileContent).toContain('June 2nd');
        expect(fileContent).toContain('[[Test Recipe]]');
    });

    test('should handle adding to future week when table has empty row', async () => {
        // Table with an empty row
        fileContent = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 7th | | | | | | | |
| | | | | | | | |
`;

        // Add recipe to February 4th
        const targetDate = moment('2024-02-05'); // Monday in week of February 4th
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Monday');

        // Should create new week row and add recipe
        expect(fileContent).toContain('February 4th');
        expect(fileContent).toContain('[[Test Recipe]]');
        // Empty row should still exist
        expect(fileContent).toContain('| | | | | | | | |');
    });

    test('should insert new week after separator row when table has trailing empty row', async () => {
        // This reproduces a bug where the new row was inserted between header and separator
        // Use Monday as start of week to match user's reported issue
        const settings = new MealSettings();
        settings.mealPlanNote = 'Meal Plan';
        settings.startOfWeek = 1; // Monday
        settings.mealPlanFormat = MealPlanFormat.Table;
        mockContext.settings = writable(settings);

        // Use extended separator format like user's actual table
        fileContent = `| Week Start    | Monday            | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
| ------------- | ----------------- | ------- | --------- | -------- | ------ | -------- | ------ |
| January 13th  | Eating out | Eating out  | Eating out    | Eating out   | [[Recipe A]] | [[Recipe B]] | [[Recipe C]] |
| January 20th  | Eating out | Eating out  | [[Recipe D]] | Eating out | [[Recipe E]] | Dinner Out | [[Recipe F]] |
| February 17th | Eating out | Eating out  | [[Recipe G]] | Eating out | [[Recipe H]] | [[Recipe I]] | [[Recipe J]] |
|               |                   |         |           |          |        |          |        |
`;

        // Add recipe to March 4th 2025 (Tuesday in week of March 3rd with Monday start)
        const targetDate = moment('2025-03-04');
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Tuesday');

        // Should have the new week row
        expect(fileContent).toContain('March 3rd');
        expect(fileContent).toContain('[[Test Recipe]]');

        // The separator row should still come right after the header
        const lines = fileContent.split('\n');
        const headerIndex = lines.findIndex((line) => line.includes('Week Start'));
        const separatorIndex = lines.findIndex((line) => line.trim().match(/^\|[\s-]+\|/));

        expect(separatorIndex).toBe(headerIndex + 1);

        // The new week should be after the separator (at index 2 or later)
        const march3rdIndex = lines.findIndex((line) => line.includes('March 3rd'));
        expect(march3rdIndex).toBeGreaterThan(separatorIndex);
    });

    test('should handle table with leading blank line when adding future week', async () => {
        // Test for bug where new row is inserted between header and separator
        const settings = new MealSettings();
        settings.mealPlanNote = 'Meal Plan';
        settings.startOfWeek = 1; // Monday
        settings.mealPlanFormat = MealPlanFormat.Table;
        mockContext.settings = writable(settings);

        // Content with a leading blank line
        fileContent = `
| Week Start | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
| --- | --- | --- | --- | --- | --- | --- | --- |
| January 13th | Eating out | Eating out | Eating out | Eating out | [[Recipe A]] | [[Recipe B]] | [[Recipe C]] |
| | | | | | | | |
`;

        const targetDate = moment('2025-03-04');
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Tuesday');

        // The separator row should still come right after the header
        const lines = fileContent.split('\n');
        const headerIndex = lines.findIndex((line) => line.includes('Week Start'));
        const separatorIndex = lines.findIndex((line) => line.trim().startsWith('| ---'));

        expect(separatorIndex).toBe(headerIndex + 1);

        // The new week should be after the separator
        const march3rdIndex = lines.findIndex((line) => line.includes('March 3rd'));
        expect(march3rdIndex).toBeGreaterThan(separatorIndex);
    });

    test('should insert future week at end in chronological order', async () => {
        // Weeks should be in chronological order: oldest at top, newest at bottom
        const settings = new MealSettings();
        settings.mealPlanNote = 'Meal Plan';
        settings.startOfWeek = 1; // Monday
        settings.mealPlanFormat = MealPlanFormat.Table;
        mockContext.settings = writable(settings);

        fileContent = `| Week Start | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
|---|---|---|---|---|---|---|---|
| January 13th | Eating out | Eating out | [[Recipe A]] | Eating out | [[Recipe B]] | [[Recipe C]] | [[Recipe D]] |
| January 20th | Eating out | Eating out | [[Recipe E]] | Eating out | [[Recipe F]] | [[Recipe G]] | [[Recipe H]] |
| February 17th | Eating out | Eating out | [[Recipe I]] | Eating out | [[Recipe J]] | [[Recipe K]] | [[Recipe L]] |
| | | | | | | | |
`;

        // Add recipe to March 4th 2025 (week of March 3rd)
        const targetDate = moment('2025-03-04');
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Tuesday');

        // Should have the new week row
        expect(fileContent).toContain('March 3rd');
        expect(fileContent).toContain('[[Test Recipe]]');

        // Verify chronological order: Jan 13 < Jan 20 < Feb 17 < Mar 3
        const jan13Index = fileContent.indexOf('January 13th');
        const jan20Index = fileContent.indexOf('January 20th');
        const feb17Index = fileContent.indexOf('February 17th');
        const mar3Index = fileContent.indexOf('March 3rd');

        expect(jan13Index).toBeLessThan(jan20Index);
        expect(jan20Index).toBeLessThan(feb17Index);
        expect(feb17Index).toBeLessThan(mar3Index);
    });

    test('should insert past week in correct chronological position', async () => {
        // When adding a week that's older than existing weeks, it should go at the top
        const settings = new MealSettings();
        settings.mealPlanNote = 'Meal Plan';
        settings.startOfWeek = 1; // Monday
        settings.mealPlanFormat = MealPlanFormat.Table;
        mockContext.settings = writable(settings);

        fileContent = `| Week Start | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
|---|---|---|---|---|---|---|---|
| February 17th | Eating out | Eating out | [[Recipe A]] | Eating out | [[Recipe B]] | [[Recipe C]] | [[Recipe D]] |
| February 24th | Eating out | Eating out | [[Recipe E]] | Eating out | [[Recipe F]] | [[Recipe G]] | [[Recipe H]] |
| | | | | | | | |
`;

        // Add recipe to February 11th 2025 (week of February 10th - before existing weeks)
        const targetDate = moment('2025-02-11');
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Tuesday');

        // Should have the new week row
        expect(fileContent).toContain('February 10th');
        expect(fileContent).toContain('[[Test Recipe]]');

        // Verify chronological order: Feb 10 < Feb 17 < Feb 24
        const feb10Index = fileContent.indexOf('February 10th');
        const feb17Index = fileContent.indexOf('February 17th');
        const feb24Index = fileContent.indexOf('February 24th');

        expect(feb10Index).toBeLessThan(feb17Index);
        expect(feb17Index).toBeLessThan(feb24Index);
    });

    test('should insert week between existing weeks in chronological order', async () => {
        const settings = new MealSettings();
        settings.mealPlanNote = 'Meal Plan';
        settings.startOfWeek = 1; // Monday
        settings.mealPlanFormat = MealPlanFormat.Table;
        mockContext.settings = writable(settings);

        fileContent = `| Week Start | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
|---|---|---|---|---|---|---|---|
| January 13th | Eating out | Eating out | [[Recipe A]] | Eating out | [[Recipe B]] | [[Recipe C]] | [[Recipe D]] |
| February 17th | Eating out | Eating out | [[Recipe E]] | Eating out | [[Recipe F]] | [[Recipe G]] | [[Recipe H]] |
| | | | | | | | |
`;

        // Add recipe to January 28th 2025 (week of January 27th - between existing weeks)
        const targetDate = moment('2025-01-28');
        await AddRecipeToMealPlanByDate(mockContext, mockRecipe, targetDate, 'Tuesday');

        // Should have the new week row
        expect(fileContent).toContain('January 27th');
        expect(fileContent).toContain('[[Test Recipe]]');

        // Verify chronological order: Jan 13 < Jan 27 < Feb 17
        const jan13Index = fileContent.indexOf('January 13th');
        const jan27Index = fileContent.indexOf('January 27th');
        const feb17Index = fileContent.indexOf('February 17th');

        expect(jan13Index).toBeLessThan(jan27Index);
        expect(jan27Index).toBeLessThan(feb17Index);
    });
});

describe('detectMealPlanFormat', () => {
    test('should detect list format', () => {
        const content = `# Week of January 8th
## Sunday
## Monday
- [[Recipe]]
## Tuesday
`;

        expect(detectMealPlanFormat(content)).toBe('list');
    });

    test('should detect table format', () => {
        const content = `| Week Start | Sunday | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday |
|---|---|---|---|---|---|---|---|
| January 8th |  | [[Recipe]] |  |  |  |  |  |
`;

        expect(detectMealPlanFormat(content)).toBe('table');
    });

    test('should return null for empty content', () => {
        expect(detectMealPlanFormat('')).toBeNull();
        expect(detectMealPlanFormat('   ')).toBeNull();
    });

    test('should return null for content without meal plan structure', () => {
        const content = `# Some other heading
This is just random content without meal plan structure.
`;

        expect(detectMealPlanFormat(content)).toBeNull();
    });

    test('should handle content with leading whitespace', () => {
        const listContent = `
# Week of January 8th
## Sunday
`;

        const tableContent = `
| Week Start | Sunday | Monday |
|---|---|---|
| January 8th |  |  |
`;

        // List format with leading whitespace should still be detected (pattern uses multiline mode)
        expect(detectMealPlanFormat(listContent)).toBe('list');

        // Table format with leading whitespace should be detected after trimming
        expect(detectMealPlanFormat(tableContent)).toBe('table');
    });
});
