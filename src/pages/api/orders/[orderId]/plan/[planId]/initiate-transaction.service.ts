/**
 * ⚠️ BEHAVIORAL CONTRACT — initiate-transaction.service.ts
 *
 * PURPOSE: Creates Sharetribe transactions for each sub-order date in a plan.
 * This is the POINT OF NO RETURN in the order lifecycle. Once a transaction is
 * created, it can only be cancelled via operator transitions (not deleted).
 *
 * WHY Promise.all (parallel, not sequential):
 *   - normalizedOrderDetail.map(onCreateTx) runs all transaction initiations in
 *     parallel. Sharetribe allows concurrent calls; parallel creation is faster
 *     for orders with many dates (e.g., 22 working days).
 *   - PARTIAL FAILURE: If one date's transaction fails mid-batch, the previously
 *     created transactions are already committed in Sharetribe but the plan
 *     listing has not yet been updated with their IDs. Re-running initiation
 *     will re-attempt only the dates with no txId (getSubOrdersWithNoTxId).
 *     This makes the operation idempotent for new sub-orders.
 *
 * WHY EDITED SUB-ORDERS ARE HANDLED SEPARATELY:
 *   - Sub-orders that were modified after initiation (lastTransition ===
 *     INITIATE_TRANSACTION) need their OLD transaction cancelled first
 *     (OPERATOR_CANCEL_PLAN), then a new transaction created. This two-phase
 *     update is why editedSubOrders is processed after subOrdersWithNoTxId.
 *
 * WHY subAccountTrustedSdk (not integrationSdk) FOR TRANSACTION CREATION:
 *   - transactions.initiate is `privileged? true` in the process definition.
 *     Only a trusted SDK instance (exchange token from the company sub-account)
 *     can call this transition. Using integrationSdk here will throw a 403.
 *   - The company sub-account is fetched fresh every call — do not cache it.
 *
 * WHY VAT SETTINGS ARE UPDATED AFTER TRANSACTION CREATION:
 *   - The partner's current VAT setting (vat/noExportVat/direct) is snapshotted
 *     onto the order listing at transaction time. This freezes the VAT setting
 *     for payment calculation, even if the partner changes it later.
 *   - updateVatSettings must run after partnerIds is fully populated.
 *
 * INVARIANT: bookingProcessAlias in configs.ts MUST match the deployed Sharetribe
 * process alias. A mismatch causes all initiations to fail with a 404/422.
 */
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';

import {
  checkIsOrderHasInProgressState,
  getEditedSubOrders,
} from '@helpers/orderHelper';
import {
  getSubOrdersWithNoTxId,
  normalizeOrderDetail,
  prepareNewPlanOrderDetail,
} from '@pages/api/orders/utils';
import { denormalisedResponseEntities } from '@services/data';
import { fetchUser } from '@services/integrationHelper';
import { createFirebaseDocNotification } from '@services/notifications';
import { getIntegrationSdk } from '@services/sdk';
import { getSubAccountTrustedSdk } from '@services/subAccountSdk';
import config from '@src/configs';
import { Listing, Transaction, User } from '@src/utils/data';
import { formatTimestamp } from '@src/utils/dates';
import {
  ENotificationType,
  EOrderType,
  EPartnerVATSetting,
} from '@src/utils/enums';
import { ETransition } from '@utils/transaction';
import type { TListing, TObject, TTransaction } from '@utils/types';

const getNextTransition = (lastTransition: ETransition) => {
  switch (lastTransition) {
    case ETransition.INITIATE_TRANSACTION:
      return ETransition.OPERATOR_CANCEL_PLAN;

    // case partner reject & confirm sub order here

    default:
      break;
  }
};

export const initiateTransaction = async ({
  orderId,
  planId,
}: {
  orderId: string;
  planId: string;
}) => {
  // Query order and plan listing
  const integrationSdk = getIntegrationSdk();
  const [orderListing] = denormalisedResponseEntities(
    await integrationSdk.listings.show({
      id: orderId,
    }),
  );
  const [planListing] = denormalisedResponseEntities(
    await integrationSdk.listings.show({
      id: planId,
    }),
  );

  const orderData = Listing(orderListing);
  const {
    companyId,
    deliveryHour,
    plans = [],
    orderType = EOrderType.group,
    companyName = 'PCC',
    orderVATPercentage,
    serviceFees = {},
    hasSpecificPCCFee = false,
    specificPCCFee = 0,
    orderStateHistory = [],
    partnerIds: orderPartnerIds = [],
  } = orderData.getMetadata();
  const isOrderHasInProgressState =
    checkIsOrderHasInProgressState(orderStateHistory);
  const isGroupOrder = orderType === EOrderType.group;

  if (plans.length === 0 || !plans.includes(planId)) {
    throw new Error(`Invalid planId, ${planId}`);
  }

  const companyAccount = await fetchUser(companyId);
  const { subAccountId } = companyAccount.attributes.profile.privateData;
  const companySubAccount = await fetchUser(subAccountId);
  const subAccountTrustedSdk = await getSubAccountTrustedSdk(companySubAccount);
  const { orderDetail: planOrderDetail = {} } =
    Listing(planListing).getMetadata();
  const subOrdersWithNoTxId = getSubOrdersWithNoTxId(planOrderDetail);

  const editedSubOrders = getEditedSubOrders(planOrderDetail);

  // Normalize order detail
  const normalizedOrderDetail = normalizeOrderDetail({
    orderId,
    planId,
    planOrderDetail: subOrdersWithNoTxId,
    deliveryHour,
    isGroupOrder,
  });

  if (isOrderHasInProgressState && !isEmpty(editedSubOrders)) {
    const handleUpdateTxs = Object.keys(editedSubOrders).map(
      async (subOrderDate: string) => {
        const { transactionId, lastTransition } = editedSubOrders[subOrderDate];

        const nextTransition = getNextTransition(lastTransition);

        await integrationSdk.transactions.transition({
          id: transactionId,
          transition: nextTransition,
          params: {},
        });

        delete editedSubOrders[subOrderDate].transactionId;
        delete editedSubOrders[subOrderDate].lastTransition;
      },
    );

    await Promise.all(handleUpdateTxs);
  }

  const normalizedEditedOrderDetail = normalizeOrderDetail({
    orderId,
    planId,
    planOrderDetail: editedSubOrders,
    deliveryHour,
    isGroupOrder,
  });

  const transactionMap: TObject = {};
  const partnerIds: string[] = [];

  const onCreateTx = async (item: any, index: number) => {
    const {
      params: {
        listingId,
        bookingStart,
        bookingEnd,
        bookingDisplayStart,
        bookingDisplayEnd,
        extendedData: { metadata },
      },
      date,
    } = item;
    partnerIds.push(listingId);

    const createTxResponse = await subAccountTrustedSdk.transactions.initiate(
      {
        processAlias: config.bookingProcessAlias,
        transition: ETransition.INITIATE_TRANSACTION,
        params: {
          listingId,
          bookingStart,
          bookingEnd,
          bookingDisplayStart,
          bookingDisplayEnd,
          metadata: {
            ...metadata,
            timestamp: date,
            orderVATPercentage,
            serviceFees,
            hasSpecificPCCFee,
            specificPCCFee,
            subOrderName: `${companyName}_${formatTimestamp(
              bookingDisplayStart.getTime(),
            )}`,
            isLastTxOfPlan: index === normalizedOrderDetail.length - 1,
          },
        },
      },
      {
        include: ['provider'],
        expand: true,
      },
    );

    const [tx] = denormalisedResponseEntities(createTxResponse);
    const txGetter = Transaction(tx as TTransaction);

    const txId = Transaction(tx).getId() as string;
    const { provider } = txGetter.getFullData();

    createFirebaseDocNotification(ENotificationType.SUB_ORDER_INPROGRESS, {
      userId: User(provider).getId(),
      planId,
      orderId,
      transition: ETransition.INITIATE_TRANSACTION,
      subOrderDate: bookingStart.getTime(),
      subOrderName: `${companyName}_${formatTimestamp(bookingStart.getTime())}`,
    });

    transactionMap[date] = txId;

    return txId;
  };
  // Initiate transaction for each date
  await Promise.all(normalizedOrderDetail.map(onCreateTx));

  await Promise.all(normalizedEditedOrderDetail.map(onCreateTx));

  const updateVatSettings = async (_partnerIds: string[]) => {
    const partnerListings = denormalisedResponseEntities(
      await integrationSdk.listings.query({
        ids: uniq(_partnerIds),
      }),
    );
    const vatSettings = partnerListings.reduce(
      (res: TObject, partner: TListing) => {
        const partnerGetter = Listing(partner);
        const partnerId = partnerGetter.getId();

        const { vat = EPartnerVATSetting.vat } = partnerGetter.getPublicData();

        return {
          ...res,
          [partnerId]: vat in EPartnerVATSetting ? vat : EPartnerVATSetting.vat,
        };
      },
      {},
    );

    await integrationSdk.listings.update({
      id: orderId,
      metadata: {
        partnerIds: uniq(_partnerIds),
        vatSettings,
      },
    });
  };

  if (!isEmpty(subOrdersWithNoTxId)) {
    // Update new order detail of plan listing
    await integrationSdk.listings.update({
      id: planId,
      metadata: {
        orderDetail: prepareNewPlanOrderDetail(planOrderDetail, transactionMap),
      },
    });
    await updateVatSettings(partnerIds);
  }

  if (!isEmpty(editedSubOrders)) {
    await integrationSdk.listings.update({
      id: planId,
      metadata: {
        orderDetail: {
          ...planOrderDetail,
          ...prepareNewPlanOrderDetail(editedSubOrders, transactionMap),
        },
      },
    });

    await updateVatSettings(orderPartnerIds);
  }
};
