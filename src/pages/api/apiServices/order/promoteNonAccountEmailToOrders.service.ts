import { mapLimit } from 'async';
import difference from 'lodash/difference';
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';

import {
  prepareNewOrderDetailPlan,
  queryAllListings,
} from '@helpers/apiHelpers';
import logger from '@helpers/logger';
import { emailSendingFactory, EmailTemplateTypes } from '@services/email';
import { fetchUser } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import {
  EBookerOrderDraftStates,
  EListingType,
  EOrderDraftStates,
  EOrderStates,
} from '@src/utils/enums';
import type { TListing } from '@src/utils/types';
import { denormalisedResponseEntities, Listing, User } from '@utils/data';
import { normalizeInviteEmail } from '@utils/validators';

const PROMOTABLE_ORDER_STATES = [
  EBookerOrderDraftStates.bookerDraft,
  EOrderDraftStates.pendingApproval,
  EOrderDraftStates.draft,
  EOrderStates.picking,
  EOrderStates.inProgress,
];

const PLAN_UPDATE_ORDER_STATES = [
  EOrderStates.picking,
  EOrderStates.inProgress,
];

const emailMatches = (storedEmail: string, normalizedEmail: string) =>
  normalizeInviteEmail(storedEmail) === normalizedEmail;

const removeEmailFromNonAccountList = (
  nonAccountEmails: string[],
  normalizedEmail: string,
) => nonAccountEmails.filter((item) => !emailMatches(item, normalizedEmail));

const syncCompanyMemberUserId = async ({
  companyId,
  userId,
  normalizedEmail,
}: {
  companyId: string;
  userId: string;
  normalizedEmail: string;
}) => {
  const integrationSdk = getIntegrationSdk();
  const companyAccount = await fetchUser(companyId);
  const { members = {} } = User(companyAccount).getMetadata();

  const memberEntry = Object.entries(members).find(([, member]) => {
    const memberEmail = (member as { email?: string })?.email;

    return (
      memberEmail &&
      emailMatches(memberEmail, normalizedEmail) &&
      !(member as { id?: string | null })?.id
    );
  });

  if (!memberEntry) {
    return;
  }

  const [memberKey, memberValue] = memberEntry;

  await integrationSdk.users.updateProfile({
    id: companyId,
    metadata: {
      members: {
        ...members,
        [memberKey]: {
          ...(memberValue as object),
          id: userId,
        },
      },
    },
  });
};

const promoteUserOnOrder = async ({
  order,
  userId,
  normalizedEmail,
}: {
  order: TListing;
  userId: string;
  normalizedEmail: string;
}) => {
  const integrationSdk = getIntegrationSdk();
  const orderGetter = Listing(order);
  const orderId = orderGetter.getId();
  const {
    participants = [],
    anonymous = [],
    removedParticipants = [],
    nonAccountEmails = [],
    orderState,
    plans = [],
    companyId,
  } = orderGetter.getMetadata();

  if (
    !nonAccountEmails.some((email: string) =>
      emailMatches(email, normalizedEmail),
    )
  ) {
    return;
  }

  const updatedNonAccountEmails = removeEmailFromNonAccountList(
    nonAccountEmails,
    normalizedEmail,
  );

  const shouldAddToParticipants =
    PROMOTABLE_ORDER_STATES.includes(orderState) &&
    !participants.includes(userId);

  await integrationSdk.listings.update({
    id: orderId,
    metadata: {
      nonAccountEmails: updatedNonAccountEmails,
      ...(shouldAddToParticipants
        ? {
            participants: uniq(participants.concat(userId)),
            ...(isEmpty(anonymous)
              ? {}
              : { anonymous: difference(anonymous, [userId]) }),
            ...(removedParticipants.length > 0
              ? {
                  removedParticipants: difference(removedParticipants, [
                    userId,
                  ]),
                }
              : {}),
          }
        : {}),
    },
  });

  const [planId] = plans;

  if (
    shouldAddToParticipants &&
    !isEmpty(planId) &&
    PLAN_UPDATE_ORDER_STATES.includes(orderState)
  ) {
    const [planListing] = denormalisedResponseEntities(
      await integrationSdk.listings.show({ id: planId }),
    );

    const newOrderDetail = prepareNewOrderDetailPlan({
      planListing,
      newMemberIds: [userId],
    });

    await integrationSdk.listings.update({
      id: planId,
      metadata: {
        orderDetail: newOrderDetail,
      },
    });

    if (orderState === EOrderStates.picking) {
      await emailSendingFactory(
        EmailTemplateTypes.PARTICIPANT.PARTICIPANT_ORDER_PICKING,
        {
          orderId,
          participantId: userId,
        },
      );
    }
  }

  if (companyId) {
    await syncCompanyMemberUserId({ companyId, userId, normalizedEmail });
  }
};

/**
 * After sign-up, promote pending invite emails on orders into participants.
 */
const promoteNonAccountEmailToOrders = async ({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) => {
  const normalizedEmail = normalizeInviteEmail(email);

  if (isEmpty(normalizedEmail)) {
    return { promotedOrderIds: [] as string[] };
  }

  let orders: TListing[] = [];

  try {
    orders = await queryAllListings({
      query: {
        meta_listingType: EListingType.order,
        meta_nonAccountEmails: `has_any:${normalizedEmail}`,
      },
    });
  } catch (error) {
    logger.error(
      'promoteNonAccountEmailToOrders: query orders failed',
      String(error),
    );

    return { promotedOrderIds: [] as string[] };
  }

  const matchingOrders = orders.filter((order) => {
    const { nonAccountEmails = [] } = Listing(order).getMetadata();

    return nonAccountEmails.some((item: string) =>
      emailMatches(item, normalizedEmail),
    );
  });

  if (isEmpty(matchingOrders)) {
    return { promotedOrderIds: [] as string[] };
  }

  const promotedOrderIds: string[] = [];

  await mapLimit(matchingOrders, 5, async (order: TListing) => {
    try {
      await promoteUserOnOrder({ order, userId, normalizedEmail });
      promotedOrderIds.push(Listing(order).getId());
    } catch (error) {
      logger.error(
        `promoteNonAccountEmailToOrders: failed for order ${Listing(
          order,
        ).getId()}`,
        String(error),
      );
    }
  });

  return { promotedOrderIds };
};

export default promoteNonAccountEmailToOrders;
