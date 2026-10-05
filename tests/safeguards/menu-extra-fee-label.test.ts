/**
 * Safeguard (review item 2, display part): the "Phụ phí" column of the admin
 * menu list must only reflect dishes still in the menu. Production menus can
 * still hold fees for dishes removed before orphans were pruned on save.
 */
import { buildExtraFeeLabel } from '@pages/admin/partner/pending-menus/components/MenuExtraFeePanel/utils';

describe('buildExtraFeeLabel', () => {
  const metadata = { monFoodIdList: ['a'], tueFoodIdList: ['b'] };

  it('ignores the fee of a dish no longer in the menu', () => {
    expect(
      buildExtraFeeLabel({ a: 10_000, b: 10_000, removed: 50_000 }, metadata),
    ).toBe('10.000đ');
  });

  it('shows a range across the dishes still in the menu', () => {
    expect(buildExtraFeeLabel({ a: 5_000, b: 15_000 }, metadata)).toBe(
      '5.000đ – 15.000đ',
    );
  });

  it('is empty when only orphan or zero fees remain', () => {
    expect(buildExtraFeeLabel({ a: 0, removed: 50_000 }, metadata)).toBe('');
  });
});
