/**
 * MENU EXTRA FEE IMPORT SAFEGUARDS
 *
 * The import writes money. Each row names a menu and a dish by TITLE, which is
 * inherently ambiguous, so the resolver's job is to refuse to guess:
 *
 * - Two pending menus sharing a title, or two dishes sharing a name inside one
 *   menu, must be reported as errors. Silently picking one would price the
 *   wrong menu with no way for the admin to notice.
 * - A fee of 0 is a legitimate value ("no surcharge") and must not be confused
 *   with a blank cell, which is a malformed row.
 * - Rows are matched only against menus that are still editable; approval
 *   freezes the fee.
 *
 * Source: src/pages/api/apiServices/menu/importMenuExtraFees.service.ts
 */

import {
  groupFeesByMenu,
  parseImportedFee,
  resolveImportRows,
} from '@pages/api/apiServices/menu/importMenuExtraFees.service';
import type { TIntegrationListing } from '@src/utils/types';

const makeMenu = (
  id: string,
  title: string,
  foodsByDate: Record<string, Record<string, { title: string }>>,
): TIntegrationListing =>
  ({
    id: { uuid: id },
    type: 'listing',
    attributes: { title, publicData: { foodsByDate }, metadata: {} },
  } as unknown as TIntegrationListing);

const MORNING = makeMenu('menu-morning', 'Menu Sáng', {
  mon: { 'food-a': { title: 'Cơm gà' } },
  wed: { 'food-a': { title: 'Cơm gà' }, 'food-b': { title: 'Bún bò' } },
});

const LUNCH = makeMenu('menu-lunch', 'Menu Trưa', {
  mon: { 'food-a': { title: 'Cơm gà' } },
});

describe('parseImportedFee', () => {
  it.each([
    ['15.000', 15000],
    ['15,000', 15000],
    ['15000', 15000],
    [15000, 15000],
    ['0', 0],
    [0, 0],
  ])('parses %p as %p', (input, expected) => {
    expect(parseImportedFee(input)).toBe(expected);
  });

  it.each([
    ['', null],
    [null, null],
    [undefined, null],
    ['abc', null],
    [-1, null],
  ])('rejects %p', (input, expected) => {
    expect(parseImportedFee(input)).toBe(expected);
  });

  it('distinguishes a 0 fee from a blank cell', () => {
    expect(parseImportedFee('0')).toBe(0);
    expect(parseImportedFee('')).toBeNull();
  });
});

describe('resolveImportRows', () => {
  it('resolves the same dish to different menus, keeping fees independent', () => {
    const results = resolveImportRows(
      [
        { menuTitle: 'Menu Sáng', foodName: 'Cơm gà', extraFee: '15.000' },
        { menuTitle: 'Menu Trưa', foodName: 'Cơm gà', extraFee: '20.000' },
      ],
      [MORNING, LUNCH],
    );

    expect(results[0]).toMatchObject({
      status: 'ok',
      menuId: 'menu-morning',
      foodId: 'food-a',
      parsedExtraFee: 15000,
    });
    expect(results[1]).toMatchObject({
      status: 'ok',
      menuId: 'menu-lunch',
      foodId: 'food-a',
      parsedExtraFee: 20000,
    });
  });

  it('matches a dish that appears on several weekdays exactly once', () => {
    const [result] = resolveImportRows(
      [{ menuTitle: 'Menu Sáng', foodName: 'Cơm gà', extraFee: '15.000' }],
      [MORNING],
    );

    expect(result).toMatchObject({ status: 'ok', foodId: 'food-a' });
  });

  it('ignores case and surrounding whitespace in titles', () => {
    const [result] = resolveImportRows(
      [{ menuTitle: '  menu sáng ', foodName: ' cơm gà', extraFee: '15.000' }],
      [MORNING],
    );

    expect(result.status).toBe('ok');
  });

  it('reports an unknown menu rather than skipping the row silently', () => {
    const [result] = resolveImportRows(
      [{ menuTitle: 'Menu Tối', foodName: 'Cơm gà', extraFee: '15.000' }],
      [MORNING],
    );

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/Không tìm thấy thực đơn/);
  });

  it('reports a dish that is not in that menu', () => {
    const [result] = resolveImportRows(
      [{ menuTitle: 'Menu Trưa', foodName: 'Bún bò', extraFee: '15.000' }],
      [MORNING, LUNCH],
    );

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/không có trong thực đơn/);
  });

  it('refuses to guess between two menus with the same title', () => {
    const duplicate = makeMenu('menu-morning-2', 'Menu Sáng', {
      mon: { 'food-z': { title: 'Cơm gà' } },
    });

    const [result] = resolveImportRows(
      [{ menuTitle: 'Menu Sáng', foodName: 'Cơm gà', extraFee: '15.000' }],
      [MORNING, duplicate],
    );

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/trùng tên/);
    expect(result.menuId).toBeUndefined();
  });

  it('refuses to guess between two dishes with the same name in one menu', () => {
    const ambiguous = makeMenu('menu-x', 'Menu X', {
      mon: { 'food-1': { title: 'Cơm gà' }, 'food-2': { title: 'Cơm gà' } },
    });

    const [result] = resolveImportRows(
      [{ menuTitle: 'Menu X', foodName: 'Cơm gà', extraFee: '15.000' }],
      [ambiguous],
    );

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/món trùng tên/);
    expect(result.foodId).toBeUndefined();
  });

  it('rejects a malformed fee', () => {
    const [result] = resolveImportRows(
      [{ menuTitle: 'Menu Sáng', foodName: 'Cơm gà', extraFee: 'miễn phí' }],
      [MORNING],
    );

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/Phụ phí không hợp lệ/);
  });

  it('accepts a 0 fee as a real instruction to clear the surcharge', () => {
    const [result] = resolveImportRows(
      [{ menuTitle: 'Menu Sáng', foodName: 'Cơm gà', extraFee: '0' }],
      [MORNING],
    );

    expect(result).toMatchObject({ status: 'ok', parsedExtraFee: 0 });
  });

  it('reports a row missing its menu or dish', () => {
    const results = resolveImportRows(
      [
        { foodName: 'Cơm gà', extraFee: '15.000' },
        { menuTitle: 'Menu Sáng', extraFee: '15.000' },
      ],
      [MORNING],
    );

    expect(results.every((result) => result.status === 'error')).toBe(true);
    expect(results[0].error).toMatch(/Thiếu thực đơn hoặc món ăn/);
  });
});

describe('groupFeesByMenu', () => {
  it('groups valid rows per menu and drops errored ones', () => {
    const results = resolveImportRows(
      [
        { menuTitle: 'Menu Sáng', foodName: 'Cơm gà', extraFee: '15.000' },
        { menuTitle: 'Menu Sáng', foodName: 'Bún bò', extraFee: '0' },
        { menuTitle: 'Menu Tối', foodName: 'Cơm gà', extraFee: '99.000' },
      ],
      [MORNING],
    );

    expect(groupFeesByMenu(results)).toEqual({
      'menu-morning': { 'food-a': 15000, 'food-b': 0 },
    });
  });

  it('lets the last row win when a file repeats a (menu, dish) pair', () => {
    const results = resolveImportRows(
      [
        { menuTitle: 'Menu Sáng', foodName: 'Cơm gà', extraFee: '15.000' },
        { menuTitle: 'Menu Sáng', foodName: 'Cơm gà', extraFee: '25.000' },
      ],
      [MORNING],
    );

    expect(groupFeesByMenu(results)).toEqual({
      'menu-morning': { 'food-a': 25000 },
    });
  });
});
