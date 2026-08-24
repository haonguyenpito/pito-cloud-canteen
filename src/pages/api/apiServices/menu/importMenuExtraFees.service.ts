import { queryAllListings } from '@helpers/apiHelpers';
import { IntegrationListing } from '@src/utils/data';
import { EListingStates, EListingType } from '@src/utils/enums';
import type { TIntegrationListing, TObject } from '@src/utils/types';

import updateMenuExtraFees from './updateMenuExtraFees.service';

export type TMenuExtraFeeImportRow = {
  menuTitle?: string;
  foodName?: string;
  extraFee?: string | number;
};

export type TMenuExtraFeeImportResult = TMenuExtraFeeImportRow & {
  status: 'ok' | 'error';
  /** Vietnamese message shown in the preview table for a rejected row. */
  error?: string;
  menuId?: string;
  foodId?: string;
  parsedExtraFee?: number;
};

/**
 * Titles come from Excel, which may normalise Unicode differently from
 * Sharetribe. Compare on NFC + trimmed + lower-cased text. Accents are
 * significant: stripping them would let "Cơm gà" and "Com ga" collide.
 */
export const normalizeTitle = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase();

/** Accepts "15.000", "15,000", "15000" and plain numbers. 0 is valid. */
export const parseImportedFee = (value: unknown): number | null => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }

  const digitsOnly = String(value).replace(/[.,\s]/g, '');

  if (!/^\d+$/.test(digitsOnly)) {
    return null;
  }

  return Number(digitsOnly);
};

/** Every dish of a menu as `normalized title -> foodId[]`, across all weekdays. */
const buildFoodTitleIndex = (
  menu: TIntegrationListing,
): Map<string, string[]> => {
  const { foodsByDate = {} } = IntegrationListing(menu).getPublicData() || {};
  const index = new Map<string, string[]>();

  Object.values(foodsByDate as TObject).forEach((foodsOfDay: any) => {
    Object.entries(foodsOfDay || {}).forEach(
      ([foodId, food]: [string, any]) => {
        const key = normalizeTitle(food?.title);

        if (!key) {
          return;
        }

        const existing = index.get(key) || [];

        if (!existing.includes(foodId)) {
          index.set(key, [...existing, foodId]);
        }
      },
    );
  });

  return index;
};

/**
 * Matches each row to a (menu, dish) pair.
 *
 * Ambiguity is always an error rather than a guess: picking one of two menus
 * that share a title would silently price the wrong menu, and the admin would
 * have no way to notice.
 */
export const resolveImportRows = (
  rows: TMenuExtraFeeImportRow[],
  menus: TIntegrationListing[],
): TMenuExtraFeeImportResult[] => {
  const menusByTitle = new Map<string, TIntegrationListing[]>();

  menus.forEach((menu) => {
    const key = normalizeTitle(IntegrationListing(menu).getAttributes()?.title);
    menusByTitle.set(key, [...(menusByTitle.get(key) || []), menu]);
  });

  const foodIndexByMenuId = new Map<string, Map<string, string[]>>();

  return rows.map((row) => {
    const menuKey = normalizeTitle(row.menuTitle);
    const foodKey = normalizeTitle(row.foodName);

    if (!menuKey || !foodKey) {
      return { ...row, status: 'error', error: 'Thiếu thực đơn hoặc món ăn' };
    }

    const parsedExtraFee = parseImportedFee(row.extraFee);

    if (parsedExtraFee === null) {
      return { ...row, status: 'error', error: 'Phụ phí không hợp lệ' };
    }

    const matchedMenus = menusByTitle.get(menuKey) || [];

    if (matchedMenus.length === 0) {
      return {
        ...row,
        status: 'error',
        error: 'Không tìm thấy thực đơn đang chờ duyệt',
      };
    }

    if (matchedMenus.length > 1) {
      return {
        ...row,
        status: 'error',
        error: `Có ${matchedMenus.length} thực đơn trùng tên`,
      };
    }

    const [menu] = matchedMenus;
    const menuId = menu.id.uuid;

    if (!foodIndexByMenuId.has(menuId)) {
      foodIndexByMenuId.set(menuId, buildFoodTitleIndex(menu));
    }

    const matchedFoodIds = foodIndexByMenuId.get(menuId)?.get(foodKey) || [];

    if (matchedFoodIds.length === 0) {
      return {
        ...row,
        status: 'error',
        error: 'Món ăn không có trong thực đơn này',
      };
    }

    if (matchedFoodIds.length > 1) {
      return {
        ...row,
        status: 'error',
        error: `Có ${matchedFoodIds.length} món trùng tên trong thực đơn`,
      };
    }

    return {
      ...row,
      status: 'ok',
      menuId,
      foodId: matchedFoodIds[0],
      parsedExtraFee,
    };
  });
};

/** Last row wins when a file lists the same (menu, dish) twice. */
export const groupFeesByMenu = (
  results: TMenuExtraFeeImportResult[],
): Record<string, Record<string, number>> =>
  results.reduce<Record<string, Record<string, number>>>((acc, result) => {
    if (result.status !== 'ok' || !result.menuId || !result.foodId) {
      return acc;
    }

    return {
      ...acc,
      [result.menuId]: {
        ...(acc[result.menuId] || {}),
        [result.foodId]: result.parsedExtraFee as number,
      },
    };
  }, {});

/**
 * Validates an imported fee sheet, and applies it unless `dryRun`.
 *
 * Only menus that are still editable are considered — approval freezes the fee,
 * so a row naming an approved menu reports "not found" rather than failing at
 * write time.
 */
const importMenuExtraFees = async (
  rows: TMenuExtraFeeImportRow[],
  { dryRun = false }: { dryRun?: boolean } = {},
) => {
  const menus = (await queryAllListings({
    query: {
      meta_listingType: EListingType.menu,
      meta_isDeleted: false,
      meta_listingState: [EListingStates.draft, EListingStates.pendingApproval],
    },
  })) as TIntegrationListing[];

  const results = resolveImportRows(rows, menus);

  if (dryRun) {
    return results;
  }

  const feesByMenu = groupFeesByMenu(results);

  await Promise.all(
    Object.entries(feesByMenu).map(([menuId, extraFees]) =>
      // `merge`: a sheet may cover only some of a menu's dishes.
      updateMenuExtraFees(menuId, { extraFees, mode: 'merge' }),
    ),
  );

  return results;
};

export default importMenuExtraFees;
