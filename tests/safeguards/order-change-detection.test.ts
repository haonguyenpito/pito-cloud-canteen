/**
 * ORDER CHANGE DETECTION SAFEGUARDS
 *
 * These tests protect the checkOrderDetailHasChanged helper in
 * subOrderChangeAfterStartHelper.ts. This function determines whether any
 * in-progress sub-order has been modified after the order was started.
 *
 * It is used to decide whether the "unsaved changes" warning banner should
 * be displayed to admins. A false negative (returning false when changes exist)
 * would silently hide pending changes, causing them to be lost.
 *
 * The input is a map from date timestamps to arrays of change history items.
 * The function returns true if any date has at least one item in its array.
 *
 * Source: src/helpers/order/subOrderChangeAfterStartHelper.ts — checkOrderDetailHasChanged
 */

import { checkOrderDetailHasChanged } from '@helpers/order/subOrderChangeAfterStartHelper';

describe('checkOrderDetailHasChanged', () => {
  it('returns false when the input object is empty', () => {
    expect(checkOrderDetailHasChanged({})).toBe(false);
  });

  it('returns false when all dates have empty change arrays', () => {
    expect(
      checkOrderDetailHasChanged({
        '1700000000000': [],
        '1700086400000': [],
      }),
    ).toBe(false);
  });

  it('returns true when a single date has one change item', () => {
    expect(
      checkOrderDetailHasChanged({
        '1700000000000': [
          { field: 'restaurant', oldValue: 'A', newValue: 'B' } as any,
        ],
      }),
    ).toBe(true);
  });

  it('returns true when one of multiple dates has a non-empty changes array', () => {
    expect(
      checkOrderDetailHasChanged({
        '1700000000000': [],
        '1700086400000': [{ field: 'memberOrders' } as any],
        '1700172800000': [],
      }),
    ).toBe(true);
  });

  it('returns true when multiple dates all have change items', () => {
    expect(
      checkOrderDetailHasChanged({
        '1700000000000': [{ field: 'restaurant' } as any],
        '1700086400000': [
          { field: 'memberOrders' } as any,
          { field: 'lineItems' } as any,
        ],
      }),
    ).toBe(true);
  });
});
