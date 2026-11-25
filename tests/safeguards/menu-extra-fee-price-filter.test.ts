import { filterExtraFeeDayGroupsByPrice } from '@pages/admin/partner/pending-menus/components/MenuExtraFeeStep/utils';
import { EDayOfWeek } from '@src/utils/enums';

const dayGroups = [
  {
    day: EDayOfWeek.mon,
    rows: [
      { foodId: 'a', title: 'A', partnerPrice: 30000 },
      { foodId: 'b', title: 'B', partnerPrice: 45000 },
    ],
  },
  {
    day: EDayOfWeek.tue,
    rows: [{ foodId: 'c', title: 'C', partnerPrice: 60000 }],
  },
];

describe('filterExtraFeeDayGroupsByPrice', () => {
  it('keeps every dish when no bound is set', () => {
    expect(filterExtraFeeDayGroupsByPrice(dayGroups, {})).toEqual(dayGroups);
  });

  it('includes both bounds', () => {
    const result = filterExtraFeeDayGroupsByPrice(dayGroups, {
      min: 45000,
      max: 60000,
    });

    expect(result.flatMap(({ rows }) => rows.map((row) => row.foodId))).toEqual(
      ['b', 'c'],
    );
  });

  it('drops days left without a dish', () => {
    const result = filterExtraFeeDayGroupsByPrice(dayGroups, { max: 40000 });

    expect(result.map(({ day }) => day)).toEqual([EDayOfWeek.mon]);
  });

  it('treats a 0 bound as a real bound', () => {
    expect(filterExtraFeeDayGroupsByPrice(dayGroups, { max: 0 })).toEqual([]);
  });
});
