/**
 * PICKING ORDER ALLERGY SAFEGUARDS
 *
 * The delivery sheet (public tracking page) shows each eater's allergies next
 * to their food note. That data rides along in `notes`, built by the two
 * helpers below. Losing the field silently strips the kitchen's food-safety
 * warning without raising any error.
 *
 * Source: src/helpers/order/orderDetailHelper.ts
 */

import {
  groupPickingOrderByFood,
  groupPickingOrderByFoodLevels,
} from '@helpers/order/orderDetailHelper';
import { EParticipantOrderStatus } from '@utils/enums';

const joined = EParticipantOrderStatus.joined;

const buildUser = (id: string, firstName: string, allergies?: string[]) => ({
  id: { uuid: id },
  attributes: {
    profile: {
      firstName,
      lastName: 'Nguyen',
      displayName: `${firstName} Nguyen`,
      publicData: allergies ? { allergies } : {},
    },
  },
});

const orderDetail = {
  '1700000000000': {
    restaurant: {
      id: 'restaurant-1',
      foodList: {
        'food-1': { foodName: 'Cơm sườn', foodPrice: 55_000 },
      },
    },
    memberOrders: {
      user1: { foodId: 'food-1', status: joined, requirement: 'Không hành' },
      user2: { foodId: 'food-1', status: joined, requirement: '' },
    },
  },
};

describe('groupPickingOrderByFood', () => {
  it('gắn allergies của từng người vào note tương ứng', () => {
    const [result] = groupPickingOrderByFood({
      orderDetail,
      date: 1700000000000,
      participants: [
        buildUser('user1', 'An', ['shrimp', 'egg']),
        buildUser('user2', 'Binh'),
      ],
      anonymous: [],
    });

    const [foodData] = result.foodDataList;
    const noteOfUser1 = foodData.notes.find(
      (note: any) => note.memberId === 'user1',
    );
    const noteOfUser2 = foodData.notes.find(
      (note: any) => note.memberId === 'user2',
    );

    expect(noteOfUser1.allergies).toEqual(['shrimp', 'egg']);
    expect(noteOfUser2.allergies).toEqual([]);
  });

  it('trả allergies rỗng khi không tìm thấy user', () => {
    const [result] = groupPickingOrderByFood({
      orderDetail,
      date: 1700000000000,
      participants: [],
      anonymous: [],
    });

    const [foodData] = result.foodDataList;
    expect(
      foodData.notes.every((note: any) => note.allergies.length === 0),
    ).toBe(true);
  });
});

describe('groupPickingOrderByFoodLevels', () => {
  const groups = [{ id: 'group-1', name: 'Lầu 3', members: [{ id: 'user1' }] }];

  it('gắn allergies cho member trong group', () => {
    const [result] = groupPickingOrderByFoodLevels({
      orderDetail,
      date: 1700000000000,
      participants: [
        buildUser('user1', 'An', ['seafood']),
        buildUser('user2', 'Binh', ['msg']),
      ],
      anonymous: [],
      groups,
    });

    const [group] = result.dataOfGroups;
    const [foodData] = group.foodDataList;
    expect(foodData.notes[0].allergies).toEqual(['seafood']);
  });

  it('gắn allergies cho member không thuộc group nào', () => {
    const [result] = groupPickingOrderByFoodLevels({
      orderDetail,
      date: 1700000000000,
      participants: [
        buildUser('user1', 'An', ['seafood']),
        buildUser('user2', 'Binh', ['msg']),
      ],
      anonymous: [],
      groups,
    });

    const [foodData] = result.foodDataList;
    expect(foodData.notes[0].allergies).toEqual(['msg']);
  });
});
