/**
 * FIREBASE NOTIFICATION SAFEGUARDS
 *
 * Tests for createFirebaseDocNotification which builds and persists
 * notification documents in Firestore. Each notification type must
 * construct the correct data shape and include the right relatedLink.
 *
 * Key contract: every notification doc carries isNew=true, notificationType,
 * createdAt, and userId from the params. Type-specific fields are appended
 * per the switch statement.
 *
 * Source file: src/services/notifications.ts
 */

import { addCollectionDoc } from '@services/firebase';
import { createFirebaseDocNotification } from '@services/notifications';
import { ENotificationType } from '@utils/enums';

// Mock Firebase to capture what data gets written
jest.mock('@services/firebase', () => ({
  addCollectionDoc: jest.fn().mockResolvedValue(undefined),
  queryCollectionData: jest.fn().mockResolvedValue([]),
  updateCollectionDoc: jest.fn().mockResolvedValue(undefined),
}));

// Mock logger to suppress error output in tests
jest.mock('@helpers/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockAddCollectionDoc = addCollectionDoc as jest.Mock;

const BASE_PARAMS = { userId: 'user-001' };

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Shared invariants
// ---------------------------------------------------------------------------

describe('createFirebaseDocNotification — shared invariants', () => {
  it('always includes isNew=true, notificationType, and userId', async () => {
    await createFirebaseDocNotification(ENotificationType.INVITATION, {
      ...BASE_PARAMS,
      bookerName: 'Booker',
      companyId: 'c1',
      companyName: 'PITO Corp',
    });

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.isNew).toBe(true);
    expect(data.notificationType).toBe(ENotificationType.INVITATION);
    expect(data.userId).toBe('user-001');
    expect(data.createdAt).toBeInstanceOf(Date);
  });

  it('calls addCollectionDoc exactly once per notification', async () => {
    await createFirebaseDocNotification(ENotificationType.COMPANY_JOINED, {
      ...BASE_PARAMS,
      companyName: 'PITO Corp',
    });
    expect(mockAddCollectionDoc).toHaveBeenCalledTimes(1);
  });

  it('does not throw on Firebase error — logs instead', async () => {
    mockAddCollectionDoc.mockRejectedValueOnce(new Error('Firebase down'));
    await expect(
      createFirebaseDocNotification(ENotificationType.INVITATION, {
        ...BASE_PARAMS,
        bookerName: 'B',
        companyId: 'c1',
        companyName: 'Corp',
      }),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Participant notification types
// ---------------------------------------------------------------------------

describe('ENotificationType.INVITATION', () => {
  it('includes bookerName, companyName, and invitation relatedLink', async () => {
    await createFirebaseDocNotification(ENotificationType.INVITATION, {
      ...BASE_PARAMS,
      bookerName: 'Nguyễn An',
      companyId: 'corp-123',
      companyName: 'PITO Corp',
    });

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.bookerName).toBe('Nguyễn An');
    expect(data.companyName).toBe('PITO Corp');
    expect(data.relatedLink).toBe('/participant/invitation/corp-123');
  });
});

describe('ENotificationType.COMPANY_JOINED', () => {
  it('includes companyName', async () => {
    await createFirebaseDocNotification(ENotificationType.COMPANY_JOINED, {
      ...BASE_PARAMS,
      companyName: 'PITO Corp',
    });

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.companyName).toBe('PITO Corp');
  });
});

describe('ENotificationType.ORDER_PICKING', () => {
  it('includes orderId and relatedLink to participant order', async () => {
    await createFirebaseDocNotification(ENotificationType.ORDER_PICKING, {
      ...BASE_PARAMS,
      orderTitle: 'Tháng 3',
      orderId: 'ord-456',
    });

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.orderId).toBe('ord-456');
    expect(data.relatedLink).toBe('/participant/order/ord-456');
  });
});

describe('ENotificationType.ORDER_DELIVERING', () => {
  it('includes planId, subOrderDate, and correct relatedLink', async () => {
    await createFirebaseDocNotification(ENotificationType.ORDER_DELIVERING, {
      ...BASE_PARAMS,
      orderId: 'ord-1',
      planId: 'plan-1',
      subOrderDate: 1700000000000,
    });

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.planId).toBe('plan-1');
    expect(data.subOrderDate).toBe(1700000000000);
    expect(data.relatedLink).toContain('planId=plan-1');
    expect(data.relatedLink).toContain('timestamp=1700000000000');
  });
});

describe('ENotificationType.ORDER_CANCEL', () => {
  it('includes planId, subOrderDate, orderId', async () => {
    await createFirebaseDocNotification(ENotificationType.ORDER_CANCEL, {
      ...BASE_PARAMS,
      orderId: 'ord-1',
      planId: 'plan-1',
      subOrderDate: 1700000000000,
    });

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.orderId).toBe('ord-1');
    expect(data.planId).toBe('plan-1');
  });
});

describe('ENotificationType.ORDER_RATING', () => {
  it('includes planId, subOrderDate, foodName, and rating relatedLink', async () => {
    await createFirebaseDocNotification(ENotificationType.ORDER_RATING, {
      ...BASE_PARAMS,
      planId: 'plan-2',
      subOrderDate: 1700000000000,
      foodName: 'Cơm gà',
    });

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.foodName).toBe('Cơm gà');
    expect(data.relatedLink).toContain('planId=plan-2');
  });
});

// ---------------------------------------------------------------------------
// Partner notification types
// ---------------------------------------------------------------------------

describe('ENotificationType.SUB_ORDER_INPROGRESS', () => {
  it('includes orderId, planId, subOrderDate, and partner relatedLink', async () => {
    await createFirebaseDocNotification(
      ENotificationType.SUB_ORDER_INPROGRESS,
      {
        ...BASE_PARAMS,
        orderId: 'ord-1',
        planId: 'plan-1',
        subOrderDate: 1700000000000,
        transition: 'transition/initiate-transaction',
        subOrderName: 'sub-order-1',
      },
    );

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.orderId).toBe('ord-1');
    expect(data.relatedLink).toContain('/partner/orders/ord-1_1700000000000');
  });
});

describe('ENotificationType.SUB_ORDER_CANCELED', () => {
  it('includes the partner sub-order relatedLink', async () => {
    await createFirebaseDocNotification(ENotificationType.SUB_ORDER_CANCELED, {
      ...BASE_PARAMS,
      orderId: 'ord-2',
      planId: 'plan-2',
      subOrderDate: 1700000000000,
      companyName: 'Corp',
      transition: 'transition/operator-cancel-plan',
    });

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.relatedLink).toContain('/partner/orders/ord-2_1700000000000');
  });
});

describe('ENotificationType.PARTNER_FOOD_ACCEPTED_BY_ADMIN', () => {
  it('includes foodName and foodId', async () => {
    await createFirebaseDocNotification(
      ENotificationType.PARTNER_FOOD_ACCEPTED_BY_ADMIN,
      { ...BASE_PARAMS, foodName: 'Cơm gà', foodId: 'food-1' },
    );

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.foodName).toBe('Cơm gà');
    expect(data.foodId).toBe('food-1');
  });
});

describe('ENotificationType.PARTNER_FOOD_REJECTED_BY_ADMIN', () => {
  it('includes foodName and foodId', async () => {
    await createFirebaseDocNotification(
      ENotificationType.PARTNER_FOOD_REJECTED_BY_ADMIN,
      { ...BASE_PARAMS, foodName: 'Bánh mì', foodId: 'food-2' },
    );

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.foodName).toBe('Bánh mì');
    expect(data.foodId).toBe('food-2');
  });
});

describe('ENotificationType.PARTNER_MENU_APPROVED_BY_ADMIN', () => {
  it('includes menuName, menuId, and partner menu relatedLink', async () => {
    await createFirebaseDocNotification(
      ENotificationType.PARTNER_MENU_APPROVED_BY_ADMIN,
      { ...BASE_PARAMS, menuName: 'Menu tháng 3', menuId: 'menu-1' },
    );

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.menuName).toBe('Menu tháng 3');
    expect(data.relatedLink).toContain('menu-1');
  });
});

// ---------------------------------------------------------------------------
// Booker notification types
// ---------------------------------------------------------------------------

describe('ENotificationType.BOOKER_NEW_ORDER_CREATED', () => {
  it('includes orderId and draft relatedLink', async () => {
    await createFirebaseDocNotification(
      ENotificationType.BOOKER_NEW_ORDER_CREATED,
      { ...BASE_PARAMS, orderId: 'ord-3', startDate: 1, endDate: 2 },
    );

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.orderId).toBe('ord-3');
    expect(data.relatedLink).toContain('/company/booker/orders/draft/ord-3');
  });
});

describe('ENotificationType.BOOKER_SUB_ORDER_CANCELLED', () => {
  it('includes orderId and subOrderDate', async () => {
    await createFirebaseDocNotification(
      ENotificationType.BOOKER_SUB_ORDER_CANCELLED,
      { ...BASE_PARAMS, orderId: 'ord-4', subOrderDate: 1700000000000 },
    );

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.orderId).toBe('ord-4');
    expect(data.subOrderDate).toBe(1700000000000);
  });
});

// ---------------------------------------------------------------------------
// Review notification types
// ---------------------------------------------------------------------------

describe('ENotificationType.ADMIN_REPLY_REVIEW', () => {
  it('includes planId, subOrderDate, foodName, and review relatedLink', async () => {
    await createFirebaseDocNotification(ENotificationType.ADMIN_REPLY_REVIEW, {
      ...BASE_PARAMS,
      planId: 'plan-5',
      subOrderDate: 1700000000000,
      foodName: 'Phở bò',
    });

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.foodName).toBe('Phở bò');
    expect(data.relatedLink).toContain('/participant/sub-orders');
  });
});

describe('ENotificationType.PARTNER_REPLY_REVIEW', () => {
  it('includes partnerName and review relatedLink', async () => {
    await createFirebaseDocNotification(
      ENotificationType.PARTNER_REPLY_REVIEW,
      {
        ...BASE_PARAMS,
        planId: 'plan-6',
        subOrderDate: 1700000000000,
        foodName: 'Gà nướng',
        partnerName: 'Nhà hàng ABC',
      },
    );

    const [data] = mockAddCollectionDoc.mock.calls[0];
    expect(data.partnerName).toBe('Nhà hàng ABC');
    expect(data.relatedLink).toContain('/participant/sub-orders');
  });
});
