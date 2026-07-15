import { mapLimit } from 'async';
import chunk from 'lodash/chunk';
import compact from 'lodash/compact';
import difference from 'lodash/difference';
import flatten from 'lodash/flatten';
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';

import {
  prepareNewOrderDetailPlan,
  queryAllListings,
} from '@helpers/apiHelpers';
import { isUserDisabled } from '@helpers/userDisabledHelper';
import { sendIndividualEmail } from '@services/awsSES';
import { emailSendingFactory, EmailTemplateTypes } from '@services/email';
import { fetchUser } from '@services/integrationHelper';
import { getIntegrationSdk } from '@services/integrationSdk';
import { createFirebaseDocNotification } from '@services/notifications';
import { UserInviteStatus } from '@src/types/UserPermission';
import participantCompanyInvitation, {
  participantCompanyInvitationSubject,
} from '@src/utils/emailTemplate/participantCompanyInvitation';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import {
  EBookerOrderDraftStates,
  ECompanyPermission,
  EErrorCode,
  EListingType,
  ENotificationType,
  EOrderDraftStates,
  EOrderStates,
  EOrderType,
} from '@src/utils/enums';
import type { TListing } from '@src/utils/types';
import { denormalisedResponseEntities, Listing, User } from '@utils/data';

const systemSenderEmail = process.env.AWS_SES_SENDER_EMAIL;

type TAddMembersToCompanyParams = {
  userIdList: string[];
  noAccountEmailList: string[];
  companyId: string;
  bookerName?: string;
  orderId?: string;
};

const addMembersToCompanyFn = async (params: TAddMembersToCompanyParams) => {
  const { userIdList, noAccountEmailList, companyId, bookerName, orderId } =
    params;
  const integrationSdk = getIntegrationSdk();
  const companyAccount = await fetchUser(companyId);
  const companyUser = User(companyAccount);
  const { companyName } = companyUser.getPublicData();
  const { firstName, lastName, displayName } = companyUser.getProfile();
  const companyBookerName = buildFullName(firstName, lastName, {
    compareToGetLongerWith: displayName,
  });
  const { members = {} } = companyUser.getMetadata();
  const membersIdList = compact(
    Object.values(members).map((_member: any) => _member?.id),
  );
  const membersEmailList = Object.keys(members);

  // TODO: update picking for new member
  // Step 1: query picking order
  const allNeedOrders = await queryAllListings({
    query: {
      meta_listingType: EListingType.order,
      meta_orderType: EOrderType.group,
      meta_orderState: `${[
        EOrderStates.picking,
        EOrderDraftStates.draft,
        EOrderDraftStates.pendingApproval,
        EBookerOrderDraftStates.bookerDraft,
      ].join(',')}`,
      meta_companyId: companyId,
      meta_selectedGroups: 'has_any:allMembers',
    },
  });

  const allNeedUpdatePlanIds: string[] = uniq(
    compact(
      allNeedOrders.map((order: TListing) => {
        const { plans = [] } = Listing(order).getMetadata();

        return plans[0];
      }),
    ),
  );

  const allNeedUpdatePlans = flatten(
    await Promise.all(
      chunk<string>(allNeedUpdatePlanIds, 100).map(async (ids: string[]) => {
        return denormalisedResponseEntities(
          await integrationSdk.listings.query({
            ids,
          }),
        );
      }),
    ),
  );

  // * Step update data for existed user
  const newParticipantIds = difference(userIdList, membersIdList);

  // A locked account must not be re-added to a company — that would silently
  // pull them back into orders while their login stays blocked.
  const disabledAccounts = compact(
    await Promise.all(
      newParticipantIds.map(async (userId: string) => {
        const userAccount = await fetchUser(userId);

        if (!isUserDisabled(userAccount)) return null;

        return User(userAccount).getAttributes().email;
      }),
    ),
  );

  if (!isEmpty(disabledAccounts)) {
    // Hard block: a locked account must not be pulled back into a company.
    // Surfaces as a generic error on the client (handleError/addMembers thunk
    // don't propagate the server message) — the enforcement is what matters.
    throw new Error(
      `${EErrorCode.accountDisabled}: ${disabledAccounts.join(', ')}`,
    );
  }

  // Step 2. Create update function
  const updateOrderAndPlanDataFn = async (order: TListing) => {
    const _orderId = Listing(order).getId();
    const {
      participants = [],
      anonymous = [],
      plans = [],
    } = Listing(order).getMetadata();

    const participantIdDiffs = difference(newParticipantIds, participants);

    // todo: if users already in participant list, stop update process
    if (isEmpty(participantIdDiffs)) {
      console.info(
        `💫 > all new members are already participant in order ${_orderId}`,
      );
      console.info(`💫 > skipped updating order's participant list`);

      return;
    }
    // todo: update order participant & anonymous data
    await integrationSdk.listings.update({
      id: _orderId,
      metadata: {
        participants: uniq(participants.concat(participantIdDiffs)),
        anonymous: difference(anonymous, newParticipantIds),
      },
    });
    // todo: if user already in anonymous list, stop update process
    const anonymousIdDiffs = difference(newParticipantIds, anonymous);
    if (isEmpty(anonymousIdDiffs)) {
      console.info(
        `💫 > all new members are already anonymous in order ${_orderId}`,
      );
      console.info(`💫 > skipped updating plan's order detail`);

      return;
    }

    const planId = plans[0];
    if (!isEmpty(planId)) {
      const planListing = allNeedUpdatePlans.find(
        (p: TListing) => p.id.uuid === planId,
      );

      const newOrderDetail = prepareNewOrderDetailPlan({
        planListing: planListing!,
        newMemberIds: anonymousIdDiffs,
      });
      await integrationSdk.listings.update({
        id: planId,
        metadata: {
          orderDetail: newOrderDetail,
        },
      });
    }
  };
  // Step 3. Call function update data
  mapLimit(allNeedOrders, 10, updateOrderAndPlanDataFn);

  const newParticipantMembers = await Promise.all(
    newParticipantIds.map(async (userId: string) => {
      const userAccount = await fetchUser(userId);
      const { companyList: userCompanyList = [], company: existCompany = {} } =
        User(userAccount).getMetadata();
      await integrationSdk.users.updateProfile({
        id: userId,
        metadata: {
          companyList: uniq(userCompanyList.concat(companyId)),
          company: {
            ...existCompany,
            [companyId]: {
              permission: ECompanyPermission.participant,
            },
          },
        },
      });
      const { email: userEmail } = User(userAccount).getAttributes();

      return {
        [userEmail]: {
          id: userId,
          email: userEmail,
          permission: ECompanyPermission.participant,
          groups: [],
          inviteStatus: UserInviteStatus.ACCEPTED,
        },
      };
    }),
  );
  const newParticipantMembersObj = newParticipantMembers.reduce(
    (result, item) => {
      return {
        ...result,
        ...item,
      };
    },
    {},
  );

  // Step format no account email list to company member object
  const newNoAccountMemberEmailList = difference(
    noAccountEmailList,
    membersEmailList,
  );

  const newNoAccountMembers = newNoAccountMemberEmailList
    .map((email: string) => ({
      email,
      id: null,
      permission: ECompanyPermission.participant,
      groups: [],
      inviteStatus: UserInviteStatus.ACCEPTED,
    }))
    .reduce((result: any, memberObj: any) => {
      return {
        ...result,
        [memberObj.email]: { ...memberObj },
      };
    }, {});

  // Step update company account metadata
  const newCompanyMembers = {
    ...members,
    ...newNoAccountMembers,
    ...newParticipantMembersObj,
  };

  const updatedCompanyAccountResponse =
    await integrationSdk.users.updateProfile(
      {
        id: companyId,
        metadata: {
          members: newCompanyMembers,
        },
      },
      {
        include: ['profileImage'],
        expand: true,
      },
    );

  const [updatedCompanyAccount] = denormalisedResponseEntities(
    updatedCompanyAccountResponse,
  );

  // Step handle send email for new participant members
  if (isEmpty(newParticipantIds)) {
    await Promise.allSettled(
      newParticipantIds.map(async (userId: string) => {
        await emailSendingFactory(
          EmailTemplateTypes.PARTICIPANT.PARTICIPANT_COMPANY_INVITATION,
          {
            participantId: userId,
            companyId,
            orderId,
          },
        );
      }),
    );

    newParticipantIds.map(async (participantId: string) => {
      createFirebaseDocNotification(ENotificationType.INVITATION, {
        userId: participantId,
        companyName,
        companyId,
        bookerName: bookerName || companyBookerName,
      });
    });
  }
  // Step handle send email for new no account members
  newNoAccountMemberEmailList.map(async (email: string) => {
    const emailTemplate = participantCompanyInvitation({
      companyUser,
      recipientEmail: email,
      orderId,
    });

    const noFlexAccountEmailParamsData = {
      receiver: email,
      subject: participantCompanyInvitationSubject(companyName),
      content: emailTemplate as string,
      sender: systemSenderEmail as string,
    };

    sendIndividualEmail(noFlexAccountEmailParamsData);
  });

  return updatedCompanyAccount;
};

export default addMembersToCompanyFn;
