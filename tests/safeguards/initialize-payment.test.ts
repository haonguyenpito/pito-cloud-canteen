/**
 * INITIALIZE PAYMENT SERVICE SAFEGUARDS
 *
 * Guards the Firebase payment record creation logic in initialize-payment.service.ts.
 *
 * WHY THIS MATTERS:
 * - This service writes irreversible payment records to Firestore at order start.
 * - Partner records are fire-and-forget (no await), so any filtering bug silently
 *   creates wrong records that admin will see in the payment UI.
 * - Cancelled sub-orders MUST be excluded — including them over-charges the company.
 * - The in-progress edit path (isEditInProgressOrder) must UPDATE the existing
 *   client record, not create a new one — duplicates break the payment ledger.
 *
 * Source: src/pages/api/orders/[orderId]/plan/[planId]/initialize-payment.service.ts
 */

import { initializePayment } from '@pages/api/orders/[orderId]/plan/[planId]/initialize-payment.service';
import {
  adminQueryListings,
  fetchListing,
  fetchUser,
} from '@services/integrationHelper';
import {
  createPaymentRecordOnFirebase,
  queryPaymentRecordOnFirebase,
  updatePaymentRecordOnFirebase,
} from '@services/payment';
import { Listing, User } from '@src/utils/data';
import { EPaymentType } from '@src/utils/enums';
import { ETransition } from '@src/utils/transaction';

jest.mock('@services/integrationHelper', () => ({
  fetchListing: jest.fn(),
  fetchUser: jest.fn(),
  adminQueryListings: jest.fn(),
}));
jest.mock('@services/payment', () => ({
  createPaymentRecordOnFirebase: jest.fn(),
  queryPaymentRecordOnFirebase: jest.fn(),
  updatePaymentRecordOnFirebase: jest.fn(),
}));
jest.mock('@src/utils/data', () => ({
  Listing: jest.fn(),
  User: jest.fn(),
}));
jest.mock('@helpers/order/cartInfoHelper', () => ({
  calculatePriceQuotationInfoFromOrder: jest
    .fn()
    .mockReturnValue({ totalWithVAT: 5000000 }),
  calculatePriceQuotationPartner: jest
    .fn()
    .mockReturnValue({ totalWithVAT: 1200000 }),
}));
jest.mock('@helpers/order/prepareDataHelper', () => ({
  ensureVATSetting: jest.fn((v) => v),
}));
jest.mock('@helpers/orderHelper', () => ({
  checkIsOrderHasInProgressState: jest.fn().mockReturnValue(false),
  getEditedSubOrders: jest.fn().mockReturnValue({}),
}));
jest.mock('@pages/admin/order/[orderId]/helpers/AdminOrderDetail', () => ({
  generateSKU: jest.fn((type, orderId) => `${type}-${orderId}`),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PARTNER_ID = 'partner-abc';
const ORDER_ID = 'order-123';
const COMPANY_ID = 'company-xyz';

const makeOrderListing = (overrides: Record<string, any> = {}) => ({
  id: ORDER_ID,
  type: 'listing',
  attributes: {
    title: 'Test Order',
    metadata: {
      companyName: 'Acme Corp',
      deliveryHour: '11:30',
      orderVATPercentage: 10,
      quotationId: 'quotation-1',
      serviceFees: { [PARTNER_ID]: 5 },
      vatSettings: { [PARTNER_ID]: 'vat' },
      orderStateHistory: [],
      startDate: 1700000000000,
      endDate: 1700600000000,
      bookerId: 'booker-1',
      partnerIds: [PARTNER_ID],
      companyId: COMPANY_ID,
      hasSpecificPCCFee: false,
      specificPCCFee: 0,
      ...overrides,
    },
  },
});

const makeSubOrderDetail = (
  lastTransition = ETransition.INITIATE_TRANSACTION,
) => ({
  '2024-01-15': {
    restaurant: { id: PARTNER_ID, restaurantName: 'Partner Restaurant' },
    lastTransition,
  },
});

const makePlanListing = (subOrderOverrides?: Record<string, any>) => ({
  id: 'plan-456',
  type: 'listing',
  attributes: {
    metadata: {
      orderDetail: subOrderOverrides ?? makeSubOrderDetail(),
    },
  },
});

// ---------------------------------------------------------------------------
// Mock setup helper
// ---------------------------------------------------------------------------

const setupListingMock = (
  orderMeta: Record<string, any>,
  planMeta: Record<string, any>,
) => {
  (Listing as jest.Mock).mockImplementation((listing: any) => {
    const isOrder = listing.id === ORDER_ID;

    return {
      getId: () => listing.id,
      getAttributes: () => ({
        title: isOrder ? 'Test Order' : 'Plan',
      }),
      getMetadata: () => (isOrder ? orderMeta : planMeta),
    };
  });
};

const setupExternalMocks = (existingPaymentRecords: any[] = []) => {
  (fetchListing as jest.Mock).mockResolvedValue({ id: 'quotation-1' });
  (fetchUser as jest.Mock).mockResolvedValue({
    attributes: {
      profile: {
        displayName: 'Test Booker',
        protectedData: { phoneNumber: '0901234567' },
      },
    },
  });
  (User as jest.Mock).mockReturnValue({
    getProfile: () => ({ displayName: 'Test Booker' }),
    getProtectedData: () => ({ phoneNumber: '0901234567' }),
  });
  (adminQueryListings as jest.Mock).mockResolvedValue([
    { id: PARTNER_ID, attributes: { title: 'Partner Restaurant' } },
  ]);
  (queryPaymentRecordOnFirebase as jest.Mock).mockResolvedValue(
    existingPaymentRecords,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Partner payment record structure
// ---------------------------------------------------------------------------

describe('partner payment records — structure', () => {
  it('creates one partner record per active sub-order date with correct shape', async () => {
    const orderMeta = {
      companyName: 'Acme Corp',
      deliveryHour: '11:30',
      orderVATPercentage: 10,
      quotationId: 'quotation-1',
      serviceFees: { [PARTNER_ID]: 5 },
      vatSettings: { [PARTNER_ID]: 'vat' },
      orderStateHistory: [],
      startDate: 1700000000000,
      endDate: 1700600000000,
      bookerId: 'booker-1',
      partnerIds: [PARTNER_ID],
      companyId: COMPANY_ID,
      hasSpecificPCCFee: false,
      specificPCCFee: 0,
    };
    const planMeta = { orderDetail: makeSubOrderDetail() };

    setupListingMock(orderMeta, planMeta);
    setupExternalMocks();

    // Provide partner data on quotation listing
    (Listing as jest.Mock).mockImplementation((listing: any) => {
      if (listing.id === ORDER_ID) {
        return {
          getId: () => ORDER_ID,
          getAttributes: () => ({ title: 'Test Order' }),
          getMetadata: () => orderMeta,
        };
      }
      if (listing.id === 'quotation-1') {
        return {
          getId: () => 'quotation-1',
          getAttributes: () => ({ title: 'Quotation' }),
          getMetadata: () => ({
            partner: {
              [PARTNER_ID]: {
                quotation: { price: 100000 },
              },
            },
          }),
        };
      }

      return {
        getId: () => listing.id,
        getAttributes: () => ({ title: 'Plan' }),
        getMetadata: () => planMeta,
      };
    });

    const orderListing = makeOrderListing();
    const planListing = makePlanListing();
    await initializePayment(orderListing as any, planListing as any);

    // One PARTNER record should be created
    const partnerCalls = (
      createPaymentRecordOnFirebase as jest.Mock
    ).mock.calls.filter(([type]) => type === EPaymentType.PARTNER);
    expect(partnerCalls.length).toBe(1);

    const [, partnerRecord] = partnerCalls[0];
    expect(partnerRecord.orderId).toBe(ORDER_ID);
    expect(partnerRecord.partnerId).toBe(PARTNER_ID);
    expect(partnerRecord.isAdminConfirmed).toBe(false);
    expect(partnerRecord.isHideFromHistory).toBe(true);
    expect(partnerRecord.amount).toBe(0); // amount starts at 0 — filled by admin
    expect(partnerRecord.totalPrice).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Cancelled sub-orders are excluded from partner records
// ---------------------------------------------------------------------------

describe('cancelled sub-orders — excluded from payment records', () => {
  const cancelTransitions = [
    ETransition.OPERATOR_CANCEL_PLAN,
    ETransition.OPERATOR_CANCEL_AFTER_PARTNER_CONFIRMED,
    ETransition.OPERATOR_CANCEL_AFTER_PARTNER_REJECTED,
  ];

  cancelTransitions.forEach((transition) => {
    it(`does not create a partner payment record for sub-order with ${transition}`, async () => {
      const cancelledOrderDetail = {
        '2024-01-15': {
          restaurant: { id: PARTNER_ID, restaurantName: 'Partner Restaurant' },
          lastTransition: transition,
        },
      };

      const orderMeta = {
        companyName: 'Acme',
        deliveryHour: '12:00',
        orderVATPercentage: 10,
        quotationId: 'quotation-1',
        serviceFees: { [PARTNER_ID]: 5 },
        vatSettings: { [PARTNER_ID]: 'vat' },
        orderStateHistory: [],
        startDate: 1700000000000,
        endDate: 1700600000000,
        bookerId: 'booker-1',
        partnerIds: [PARTNER_ID],
        companyId: COMPANY_ID,
        hasSpecificPCCFee: false,
        specificPCCFee: 0,
      };
      const planMeta = { orderDetail: cancelledOrderDetail };

      (Listing as jest.Mock).mockImplementation((listing: any) => {
        if (listing.id === ORDER_ID) {
          return {
            getId: () => ORDER_ID,
            getAttributes: () => ({ title: 'Test Order' }),
            getMetadata: () => orderMeta,
          };
        }
        if (listing.id === 'quotation-1') {
          return {
            getId: () => 'quotation-1',
            getAttributes: () => ({ title: 'Quotation' }),
            getMetadata: () => ({
              partner: { [PARTNER_ID]: { quotation: { price: 100000 } } },
            }),
          };
        }

        return {
          getId: () => listing.id,
          getAttributes: () => ({ title: 'Plan' }),
          getMetadata: () => planMeta,
        };
      });
      setupExternalMocks();

      const orderListing = makeOrderListing();
      const planListing = makePlanListing(cancelledOrderDetail);
      await initializePayment(orderListing as any, planListing as any);

      const partnerCalls = (
        createPaymentRecordOnFirebase as jest.Mock
      ).mock.calls.filter(([type]) => type === EPaymentType.PARTNER);
      expect(partnerCalls.length).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Client payment record — new order vs. edited in-progress order
// ---------------------------------------------------------------------------

describe('client payment record — new order creates; edited in-progress order updates', () => {
  it('creates a client payment record for a new order', async () => {
    const { checkIsOrderHasInProgressState, getEditedSubOrders } =
      jest.requireMock('@helpers/orderHelper');
    checkIsOrderHasInProgressState.mockReturnValue(false);
    getEditedSubOrders.mockReturnValue({});

    const orderMeta = {
      companyName: 'Acme',
      deliveryHour: '12:00',
      orderVATPercentage: 10,
      quotationId: 'quotation-1',
      serviceFees: {},
      vatSettings: {},
      orderStateHistory: [],
      startDate: 1700000000000,
      endDate: 1700600000000,
      bookerId: 'booker-1',
      partnerIds: [],
      companyId: COMPANY_ID,
      hasSpecificPCCFee: false,
      specificPCCFee: 0,
    };
    const planMeta = { orderDetail: {} };

    (Listing as jest.Mock).mockImplementation((listing: any) => {
      if (listing.id === ORDER_ID) {
        return {
          getId: () => ORDER_ID,
          getAttributes: () => ({ title: 'Test Order' }),
          getMetadata: () => orderMeta,
        };
      }
      if (listing.id === 'quotation-1') {
        return {
          getId: () => 'quotation-1',
          getAttributes: () => ({ title: 'Quotation' }),
          getMetadata: () => ({ partner: {} }),
        };
      }

      return {
        getId: () => listing.id,
        getAttributes: () => ({ title: 'Plan' }),
        getMetadata: () => planMeta,
      };
    });
    setupExternalMocks();

    const orderListing = makeOrderListing();
    const planListing = makePlanListing({});
    await initializePayment(orderListing as any, planListing as any);

    const clientCalls = (
      createPaymentRecordOnFirebase as jest.Mock
    ).mock.calls.filter(([type]) => type === EPaymentType.CLIENT);
    expect(clientCalls.length).toBe(1);
    expect(updatePaymentRecordOnFirebase).not.toHaveBeenCalled();
  });

  it('updates existing client payment record when order is in-progress with edits', async () => {
    const { checkIsOrderHasInProgressState, getEditedSubOrders } =
      jest.requireMock('@helpers/orderHelper');
    checkIsOrderHasInProgressState.mockReturnValue(true);
    getEditedSubOrders.mockReturnValue({
      '2024-01-15': {
        restaurant: { id: PARTNER_ID },
        lastTransition: ETransition.INITIATE_TRANSACTION,
      },
    });

    const existingRecord = { id: 'payment-rec-1', orderId: ORDER_ID };

    const orderMeta = {
      companyName: 'Acme',
      deliveryHour: '12:00',
      orderVATPercentage: 10,
      quotationId: 'quotation-1',
      serviceFees: {},
      vatSettings: {},
      orderStateHistory: [],
      startDate: 1700000000000,
      endDate: 1700600000000,
      bookerId: 'booker-1',
      partnerIds: [],
      companyId: COMPANY_ID,
      hasSpecificPCCFee: false,
      specificPCCFee: 0,
    };
    const planMeta = { orderDetail: {} };

    (Listing as jest.Mock).mockImplementation((listing: any) => {
      if (listing.id === ORDER_ID) {
        return {
          getId: () => ORDER_ID,
          getAttributes: () => ({ title: 'Test Order' }),
          getMetadata: () => orderMeta,
        };
      }
      if (listing.id === 'quotation-1') {
        return {
          getId: () => 'quotation-1',
          getAttributes: () => ({ title: 'Quotation' }),
          getMetadata: () => ({ partner: {} }),
        };
      }

      return {
        getId: () => listing.id,
        getAttributes: () => ({ title: 'Plan' }),
        getMetadata: () => planMeta,
      };
    });
    setupExternalMocks([existingRecord]);

    const orderListing = makeOrderListing();
    const planListing = makePlanListing({});
    await initializePayment(orderListing as any, planListing as any);

    expect(updatePaymentRecordOnFirebase).toHaveBeenCalledWith(
      existingRecord.id,
      expect.objectContaining({ orderId: ORDER_ID }),
    );

    const clientCalls = (
      createPaymentRecordOnFirebase as jest.Mock
    ).mock.calls.filter(([type]) => type === EPaymentType.CLIENT);
    expect(clientCalls.length).toBe(0);
  });
});
