import { truncateToLines } from '@components/OrderDetails/ReviewView/ReviewOrdersResultSection/UserLabelText';

// Thermal label: 56mm of usable width.
const WIDTH_MM = 56;

describe('truncateToLines', () => {
  it('leaves text that fits untouched', () => {
    expect(
      truncateToLines({
        text: 'Chả Giò Huế',
        widthMm: WIDTH_MM,
        fontMm: 3.4,
        maxLines: 2,
      }),
    ).toBe('Chả Giò Huế');
  });

  it('truncates with an ellipsis once the line budget runs out', () => {
    const foodName =
      'Mì xá xíu trộn sốt dầu hào, súp tiềm thảo mộc (Set Premium) / Pork noodle soup with oyster sauce and herbal broth (Premium Set)';
    const result = truncateToLines({
      text: foodName,
      widthMm: WIDTH_MM,
      fontMm: 3.4,
      maxLines: 2,
    });

    // 56 / (3.4 * 0.5) => 32 chars per line, 2 lines.
    expect(result).toHaveLength(64);
    expect(result.endsWith('…')).toBe(true);
    expect(foodName.startsWith(result.slice(0, -1).trim())).toBe(true);
  });
});
