/* eslint-disable react-hooks/exhaustive-deps */
import { useMemo, useState } from 'react';
import isEmpty from 'lodash/isEmpty';
import { useRouter } from 'next/router';

import { parseThousandNumber } from '@helpers/format';
import {
  calculatePriceQuotationInfoFromOrder,
  calculatePriceQuotationInfoFromQuotation,
} from '@helpers/order/cartInfoHelper';
import {
  groupFoodOrderByDate,
  groupFoodOrderByDateFromQuotation,
} from '@helpers/order/orderDetailHelper';
import {
  getIsAllowAddSecondaryFood,
  isEnableToStartOrder,
} from '@helpers/orderHelper';
import { useAppSelector } from '@hooks/reduxHooks';
import { currentUserSelector } from '@redux/slices/user.slice';
import { companyPaths } from '@src/paths';
import { Listing, User } from '@utils/data';
import { EOrderStates, EOrderType, EPartnerVATSetting } from '@utils/enums';
import type { TCurrentUser, TListing, TObject, TUser } from '@utils/types';

export const usePrepareOrderDetailPageData = ({
  date,
  VATPercentage,
  serviceFeePercentage,
  partnerId,
  isAdminLayout = false,
  isPartner = false,
  vatSetting = EPartnerVATSetting.vat,
}: {
  date?: string | number;
  VATPercentage?: number;
  serviceFeePercentage?: number;
  partnerId?: string;
  isAdminLayout?: boolean;
  isPartner?: boolean;
  vatSetting?: EPartnerVATSetting;
}) => {
  const router = useRouter();
  const [reviewInfoValues, setReviewInfoValues] = useState<any>();

  const {
    orderData,
    planData,
    participantData,
    anonymousParticipantData,
    companyData,
    bookerData,
    quotation,
    draftOrderDetail,
    draftSubOrderChangesHistory,
  } = useAppSelector((state) => state.OrderManagement);

  const currentOrderVATPercentage = useAppSelector(
    (state) => state.SystemAttributes.currentOrderVATPercentage,
  );
  const systemVATPercentage = useAppSelector(
    (state) => state.SystemAttributes.systemVATPercentage,
  );
  const currentUser = useAppSelector(currentUserSelector);

  const { title: orderTitle = '' } = Listing(
    orderData as TListing,
  ).getAttributes();
  const constCurrUserAttributes = User(
    currentUser as TCurrentUser,
  ).getAttributes();
  const { orderDetail = {} } = Listing(planData as TListing).getMetadata();
  const { companyName = '' } = User(companyData as TUser).getPublicData();
  const {
    hasSpecificPCCFee = false,
    specificPCCFee = 0,
    specificPCCFeeTiers,
  } = User(companyData as TUser).getMetadata();

  const {
    email: bookerEmail,
    profile: {
      displayName: contactPeopleName = '',
      protectedData: { phoneNumber: protectedContactPhoneNumber = '' } = {},
      publicData: { phoneNumber: publicContactPhoneNumber = '' } = {},
    },
  } =
    bookerData !== null
      ? User(bookerData).getAttributes()
      : constCurrUserAttributes;

  const {
    startDate = 0,
    endDate = 0,
    deliveryHour,
    deliveryAddress,
    deadlineDate = 0,
    deadlineHour,
    packagePerMember = 0,
    participants = [],
    anonymous = [],
    staffName = '',
    orderState,
    ratings,
    orderType = EOrderType.group,
    orderNote = '',
    hasSpecificPCCFee: orderHasSpecificPCCFee,
    specificPCCFee: orderPCCFee = 0,
    specificPCCFeeTiers: orderSpecificPCCFeeTiers,
    contactPeopleName: contactPeopleNameFromOrder,
    contactPhoneNumber: contactPhoneNumberFromOrder,
  } = Listing(orderData as TListing).getMetadata();
  const isGroupOrder = orderType === EOrderType.group;
  const isCanceledOrder = [
    EOrderStates.canceled || EOrderStates.canceledByBooker,
  ].includes(orderState);
  const canStartOrder = isEnableToStartOrder(
    orderDetail,
    isGroupOrder,
    isAdminLayout,
  );
  const isOrderIsPicking = orderState === EOrderStates.picking;
  const isOrderIsInProgress = orderState === EOrderStates.inProgress;
  const initVatPercentage = isOrderIsInProgress
    ? VATPercentage!
      ? VATPercentage!
      : currentOrderVATPercentage
    : systemVATPercentage;
  const canReview =
    orderState === EOrderStates.completed ||
    (orderState === EOrderStates.pendingPayment && !ratings);
  const titleSectionData = {
    deliveryHour,
    deliveryAddress,
    canStartOrder,
    isGroupOrder,
    deadlineDate,
    deadlineHour,
    startDate,
  };
  const countdownSectionData = {
    deadlineHour,
    orderDeadline: deadlineDate,
    startDate,
  };
  const linkSectionData = {
    orderDeadline: deadlineDate,
    companyName,
    companyId: companyData?.id?.uuid,
  };
  const manageParticipantData = {
    planData,
    participants,
    participantData,
  };

  const manageOrdersData = {
    startDate,
    endDate,
  };
  /* =============== Edit data =============== */
  const editViewData = {
    titleSectionData,
    countdownSectionData,
    linkSectionData,
    manageParticipantData,
    manageOrdersData,
  };
  /* =============== Review data =============== */
  const isOrderEditing = !isEmpty(draftSubOrderChangesHistory);
  const foodOrderGroupedByDateFromOrderDetail = useMemo(
    () =>
      groupFoodOrderByDate({
        orderDetail,
        isGroupOrder,
        date,
      }),
    [JSON.stringify(orderDetail), isGroupOrder],
  );
  const foodOrderGroupedByDateFromQuotation = useMemo(
    () =>
      groupFoodOrderByDateFromQuotation({
        quotation: quotation as TListing,
        date,
      }),
    [JSON.stringify(quotation)],
  );
  const foodOrderGroupedByDateFromDraftOrderDetail = useMemo(
    () =>
      groupFoodOrderByDate({
        orderDetail: draftOrderDetail,
        isGroupOrder,
        date,
      }),
    [JSON.stringify(draftOrderDetail), isGroupOrder],
  );
  // cho nay
  const foodOrderGroupedByDate = isOrderIsPicking
    ? foodOrderGroupedByDateFromOrderDetail
    : isOrderEditing
    ? foodOrderGroupedByDateFromDraftOrderDetail
    : foodOrderGroupedByDateFromQuotation;

  const quotationInfoFromOrder = useMemo(
    () =>
      calculatePriceQuotationInfoFromOrder({
        planOrderDetail: orderDetail,
        order: orderData as TObject,
        orderVATPercentage: initVatPercentage,
        date,
        orderServiceFeePercentage: serviceFeePercentage,
        shouldIncludePITOFee: isEmpty(date),
        hasSpecificPCCFee:
          orderHasSpecificPCCFee !== undefined
            ? orderHasSpecificPCCFee
            : hasSpecificPCCFee,
        specificPCCFee:
          orderHasSpecificPCCFee !== undefined ? orderPCCFee : specificPCCFee,
        specificPCCFeeTiers:
          orderHasSpecificPCCFee !== undefined
            ? orderSpecificPCCFeeTiers
            : specificPCCFeeTiers,
        isPartner,
        vatSetting,
      }),
    [
      JSON.stringify(orderData),
      JSON.stringify(orderDetail),
      date,
      initVatPercentage,
      serviceFeePercentage,
      hasSpecificPCCFee,
      orderHasSpecificPCCFee,
      specificPCCFee,
      orderPCCFee,
      JSON.stringify(specificPCCFeeTiers),
      JSON.stringify(orderSpecificPCCFeeTiers),
      isPartner,
      vatSetting,
    ],
  );
  const quotationInfoFormDraftEdit = useMemo(
    () =>
      calculatePriceQuotationInfoFromOrder({
        planOrderDetail: draftOrderDetail,
        order: orderData as TObject,
        date,
        orderVATPercentage: initVatPercentage,
        orderServiceFeePercentage: serviceFeePercentage,
        shouldIncludePITOFee: isEmpty(date),
        hasSpecificPCCFee: orderHasSpecificPCCFee,
        specificPCCFee: orderPCCFee,
        specificPCCFeeTiers: orderSpecificPCCFeeTiers,
        vatSetting,
      }),
    [
      JSON.stringify(draftOrderDetail),
      JSON.stringify(orderData),
      date,
      orderPCCFee,
      currentOrderVATPercentage,
      orderHasSpecificPCCFee,
      JSON.stringify(orderSpecificPCCFeeTiers),
      serviceFeePercentage,
      initVatPercentage,
      vatSetting,
    ],
  );
  const quotationInfoFromQuotation = useMemo(
    () =>
      calculatePriceQuotationInfoFromQuotation({
        quotation: quotation as TListing,
        packagePerMember,
        orderVATPercentage: initVatPercentage,
        orderServiceFeePercentage: serviceFeePercentage,
        date,
        partnerId,
        hasSpecificPCCFee: orderHasSpecificPCCFee,
        specificPCCFee: orderPCCFee,
        specificPCCFeeTiers: orderSpecificPCCFeeTiers,
        isPartner,
        vatSetting,
      }),
    [
      packagePerMember,
      JSON.stringify(quotation),
      orderHasSpecificPCCFee,
      orderPCCFee,
      JSON.stringify(orderSpecificPCCFeeTiers),
      initVatPercentage,
      serviceFeePercentage,
      isPartner,
      partnerId,
      date,
      vatSetting,
    ],
  );

  const {
    totalPrice = 0,
    PITOPoints = 0,
    VATFee = 0,
    totalWithVAT = 0,
    serviceFee = 0,
    transportFee = 0,
    promotion = 0,
    overflow,
    PITOFee = 0,
    totalWithoutVAT = 0,
    vatPercentage = 0,
  } = useMemo(
    () =>
      isOrderIsPicking
        ? quotationInfoFromOrder
        : isOrderEditing
        ? quotationInfoFormDraftEdit
        : quotationInfoFromQuotation,
    [
      isOrderIsPicking,
      isOrderEditing,
      JSON.stringify(quotationInfoFromOrder),
      JSON.stringify(quotationInfoFromQuotation),
      JSON.stringify(quotationInfoFormDraftEdit),
    ],
  );
  const reviewInfoData = {
    reviewInfoValues,
    deliveryHour,
    deliveryAddress: deliveryAddress?.address || '',
    staffName,
    companyName,
    contactPeopleName: contactPeopleNameFromOrder || contactPeopleName,
    contactPeopleEmail: bookerEmail,
    contactPhoneNumber:
      contactPhoneNumberFromOrder ||
      protectedContactPhoneNumber ||
      publicContactPhoneNumber,
  };

  const reviewResultData = {
    participants,
    participantData,
    anonymous,
    anonymousParticipantData,
    orderDetail: isOrderEditing ? draftOrderDetail : orderDetail,
  };
  const reviewCartData = {
    overflow,
    PITOPoints,
    promotion,
    serviceFee,
    totalPrice,
    totalWithoutVAT,
    totalWithVAT,
    transportFee,
    VATFee,
    PITOFee,
    vatPercentage,
    serviceFeePercentage,
  };
  const reviewViewData = {
    isGroupOrder,
    orderTitle,
    reviewInfoData,
    reviewResultData,
    reviewCartData,
    foodOrderGroupedByDate,
    isCanceledOrder,
    orderNoteData: {
      orderNote,
      disabled: orderState !== EOrderStates.picking,
    },
    isSecondaryFoodAllowedOrder:
      orderType === EOrderType.group
        ? getIsAllowAddSecondaryFood(orderData as TListing)
        : false,
  };
  /* =============== Price quotation data =============== */
  const priceQuotationData = {
    customerData: {
      ...(reviewInfoValues || reviewInfoData),
      email: bookerEmail,
    },
    orderData: {
      orderTitle,
      companyName,
      startDate,
      endDate,
      deliveryHour,
    },
    cartData: {
      serviceFee: `${parseThousandNumber(serviceFee)}đ`,
      totalPrice: `${parseThousandNumber(totalPrice)}đ`,
      promotion: `${parseThousandNumber(promotion)}đ`,
      totalWithVAT: `${parseThousandNumber(totalWithVAT)}đ`,
      transportFee: `${parseThousandNumber(transportFee)}đ`,
      VATFee: `${parseThousandNumber(VATFee)}đ`,
      PITOFee: `${parseThousandNumber(PITOFee)}đ`,
      vatPercentage,
    },
    orderDetailData: {
      foodOrderGroupedByDate,
      isAllowAddSecondaryFood: getIsAllowAddSecondaryFood(
        orderData as TListing,
      ),
    },
  };

  const goToReviewPage = () => {
    router.push({
      pathname: companyPaths.OrderRating,
      query: { orderId: orderData?.id.uuid },
    });
  };

  return {
    canReview,
    goToReviewPage,
    orderTitle,
    editViewData,
    reviewViewData,
    priceQuotationData,
    reviewInfoValues,
    setReviewInfoValues,
    orderData,
  };
};
