const uniq = require('lodash/uniq');
const isEmpty = require('lodash/isEmpty');
const pick = require('lodash/pick');
const { DateTime } = require('luxon');

const {
  TRANSITIONS,
  PARTNER_VAT_SETTINGS,
  TRANSITIONS_TO_STATE_CANCELED,
  ORDER_TYPES,
} = require('../../utils/enums');
const { Listing } = require('../../utils/data');

const ensureVATSetting = (vatSetting) =>
  Object.values(PARTNER_VAT_SETTINGS).includes(vatSetting)
    ? vatSetting
    : PARTNER_VAT_SETTINGS.vat;

const vatPercentageBaseOnVatSetting = ({
  vatSetting,
  vatPercentage = 0,
  isPartner = true,
}) => {
  if (!isPartner) {
    return vatPercentage;
  }

  switch (vatSetting) {
    case PARTNER_VAT_SETTINGS.direct:
      return 0;
    case PARTNER_VAT_SETTINGS.noExportVat:
      return -0.04;
    case PARTNER_VAT_SETTINGS.vat:
    default:
      return vatPercentage;
  }
};

const calculateVATFee = ({
  vatPercentage,
  partnerVATSetting,
  orderProvisionalPrice,
  orderMenuPrice,
  target = 'partner',
}) => {
  if (!(target === 'partner')) {
    return Math.round(orderProvisionalPrice * vatPercentage);
  }

  if (target === 'partner') {
    switch (partnerVATSetting) {
      case PARTNER_VAT_SETTINGS.noExportVat:
        return Math.round(orderMenuPrice * vatPercentage);
      default:
        return Math.round(orderProvisionalPrice * vatPercentage);
    }
  }

  // Safe return - Never reach here
  return 0;
};

const convertHHmmStringToTimeParts = (timeStr = '6:30') => {
  const [hours, minutes] = timeStr.split(':') || ['6', '30'];

  return { hours: parseInt(hours, 10), minutes: parseInt(minutes, 10) };
};

const isJoinedPlan = (foodId, status) => {
  return foodId !== '' && status === 'joined';
};

const checkIsOrderHasInProgressState = (orderStateHistory) => {
  return orderStateHistory.some((state) => state.state === 'inProgress');
};

const normalizeOrderDetail = ({
  orderId,
  planId,
  planOrderDetail,
  deliveryHour = '06:30 - 06:45',
  isGroupOrder = true,
}) => {
  return Object.entries(planOrderDetail).reduce((prev, [date, orderOfDate]) => {
    const {
      restaurant = {},
      memberOrders: memberOrdersMap,
      lineItems = [],
      transactionId,
      lastTransition,
    } = orderOfDate;

    const { id: restaurantId, foodList = {} } = restaurant;

    if (lastTransition || !restaurantId) {
      return prev;
    }

    const startDate = DateTime.fromMillis(Number(date));
    const bookingStart = startDate.toJSDate();
    const bookingEnd = startDate.plus({ days: 1 }).toJSDate();
    const bookingDisplayStart = startDate
      .plus({
        ...convertHHmmStringToTimeParts(deliveryHour.split(' - ')[0]),
      })
      .toJSDate();
    const bookingDisplayEnd = bookingEnd;

    if (isGroupOrder) {
      const { participantIds, bookingInfo } = Object.entries(
        memberOrdersMap,
      ).reduce(
        (
          prevResult,
          [
            participantId,
            {
              foodId,
              status,
              requirement,
              secondaryFoodId,
              secondaryRequirement,
            },
          ],
        ) => {
          const {
            participantIds: prevParticipantList = [],
            bookingInfo: prevBookingInfo = [],
          } = prevResult;
          const currFoodInfo = foodList[foodId];
          const currSecondaryFoodInfo = secondaryFoodId
            ? foodList[secondaryFoodId]
            : null;
          if (currFoodInfo && isJoinedPlan(foodId, status)) {
            return {
              ...prevResult,
              participantIds: prevParticipantList.concat(participantId),
              bookingInfo: prevBookingInfo.concat({
                foodId,
                ...currFoodInfo,
                participantId,
                requirement,
                ...(currSecondaryFoodInfo && {
                  secondaryFoodId,
                  secondaryFoodName: currSecondaryFoodInfo?.foodName,
                  secondaryFoodPrice: currSecondaryFoodInfo?.foodPrice,
                  secondaryRequirement,
                }),
              }),
            };
          }

          return prevResult;
        },
        { participantIds: [], bookingInfo: [] },
      );

      const extendedData = {
        metadata: {
          participantIds,
          bookingInfo,
          orderId,
          planId,
        },
      };

      return isEmpty(participantIds)
        ? prev
        : prev.concat({
            params: {
              listingId: restaurantId,
              extendedData,
              bookingStart,
              bookingEnd,
              bookingDisplayStart,
              bookingDisplayEnd,
              transactionId,
            },
            date,
          });
    }

    const extendedData = {
      metadata: {
        lineItems,
        orderId,
        planId,
      },
    };

    return isEmpty(lineItems)
      ? prev
      : prev.concat({
          params: {
            listingId: restaurantId,
            extendedData,
            bookingStart,
            bookingEnd,
            bookingDisplayStart,
            bookingDisplayEnd,
            transactionId,
          },
          date,
        });
  }, []);
};

const isEnableToCancelOrder = (orderDetail) => {
  return (
    isEmpty(orderDetail) ||
    Object.values(orderDetail).some((orderDetailOnDate) => {
      const { restaurant = {}, memberOrders = {} } = orderDetailOnDate || {};
      const { foodList, id: restaurantId, minQuantity = 1 } = restaurant;
      console.info('💫 > restaurant: ', restaurant);
      console.info('💫 > minQuantity: ', minQuantity);

      if (isEmpty(foodList) && isEmpty(restaurantId)) {
        return false;
      }

      const pickedFoodCount = Object.values(memberOrders).reduce(
        (total, currentMemberOrder) => {
          if (
            isJoinedPlan(
              currentMemberOrder?.foodId || '',
              currentMemberOrder?.status || 'joined',
            )
          ) {
            return total + 1;
          }

          return total;
        },
        0,
      );
      console.info('💫 > pickedFoodCount: ', pickedFoodCount);

      return pickedFoodCount === 0 || pickedFoodCount < minQuantity;
    })
  );
};

const prepareNewPlanOrderDetail = (planOrderDetail, transactionIdMap) => {
  if (isEmpty(transactionIdMap)) {
    return planOrderDetail;
  }

  return Object.entries(planOrderDetail).reduce((prev, [date, orderOfDate]) => {
    return {
      ...prev,
      [date]: {
        ...orderOfDate,
        transactionId: transactionIdMap[date],
        lastTransition: TRANSITIONS.INITIATE_TRANSACTION,
      },
    };
  }, {});
};

const getPickFoodParticipants = (orderDetail) => {
  const shouldSendNativeNotificationParticipantIdList = Object.entries(
    orderDetail,
  ).reduce((acc, [, subOrder]) => {
    const { memberOrders = {} } = subOrder;
    const memberHasPickFood = Object.keys(memberOrders).filter((memberId) => {
      return memberOrders[memberId].foodId;
    });

    return uniq([...acc, ...memberHasPickFood]);
  }, []);

  return shouldSendNativeNotificationParticipantIdList;
};

const getPCCFeeByMemberAmount = (memberAmount) => {
  if (!memberAmount) {
    return 0;
  }

  if (memberAmount < 45) {
    return 169000;
  }

  if (memberAmount < 60) {
    return 210000;
  }

  if (memberAmount < 75) {
    return 258000;
  }

  if (memberAmount < 105) {
    return 333000;
  }

  if (memberAmount < 130) {
    return 396000;
  }

  if (memberAmount < 150) {
    return 438000;
  }

  if (memberAmount < 200) {
    return 558000;
  }

  return 540000;
};

const calculatePCCFeeByDate = ({
  isGroupOrder,
  memberOrders = {},
  lineItems = [],
  hasSpecificPCCFee,
  specificPCCFee,
}) => {
  const memberAmountOfDate = isGroupOrder
    ? Object.values(memberOrders).reduce((resultOfDate, currentMemberOrder) => {
        const { foodId, status } = currentMemberOrder;

        return isJoinedPlan(foodId, status) ? resultOfDate + 1 : resultOfDate;
      }, 0)
    : lineItems.reduce((res, item) => {
        return res + (item?.quantity || 1);
      }, 0);

  const PCCFeeOfDate = hasSpecificPCCFee
    ? memberAmountOfDate > 0
      ? specificPCCFee
      : 0
    : getPCCFeeByMemberAmount(memberAmountOfDate);

  return PCCFeeOfDate;
};

const getFoodDataMap = ({
  foodListOfDate = {},
  memberOrders = {},
  orderType = ORDER_TYPES.group,
  lineItems = [],
}) => {
  if (orderType === ORDER_TYPES.group) {
    return Object.entries(memberOrders).reduce(
      (foodFrequencyResult, currentMemberOrderEntry) => {
        const [, memberOrderData] = currentMemberOrderEntry;
        const { foodId, status, secondaryFoodId } = memberOrderData;

        const updateFoodFrequency = (result, id) => {
          if (!isJoinedPlan(id, status) || !id) return result;

          const { foodName, foodPrice } = foodListOfDate[id] || {};
          const data = result[id];
          const { frequency } = data || {};

          return {
            ...result,
            [id]: data
              ? { ...data, frequency: frequency + 1 }
              : { foodId: id, foodName, foodPrice, frequency: 1 },
          };
        };

        let updatedResult = updateFoodFrequency(foodFrequencyResult, foodId);
        updatedResult = updateFoodFrequency(updatedResult, secondaryFoodId);

        return updatedResult;
      },
      {},
    );
  }

  return lineItems.reduce((result, item) => {
    const { id, name, quantity, unitPrice } = item;

    return {
      ...result,
      [id]: {
        foodId: id,
        foodName: name,
        foodPrice: unitPrice,
        frequency: quantity,
      },
    };
  }, {});
};

const getTotalInfo = (foodDataList) => {
  return foodDataList.reduce(
    (previousResult, current) => {
      const { totalPrice, totalDishes } = previousResult;
      const { frequency, foodPrice } = current;

      return {
        ...previousResult,
        totalDishes: totalDishes + frequency,
        totalPrice: totalPrice + foodPrice * frequency,
      };
    },
    {
      totalDishes: 0,
      totalPrice: 0,
    },
  );
};

const calculateTotalPriceAndDishes = ({
  orderDetail = {},
  isGroupOrder,
  date,
}) => {
  return isGroupOrder
    ? Object.entries(orderDetail).reduce(
        (result, currentOrderDetailEntry) => {
          const [dateKey, rawOrderDetailOfDate] = currentOrderDetailEntry;
          if (date && date?.toString() !== dateKey) {
            return result;
          }

          const {
            memberOrders,
            restaurant = {},
            status,
            lastTransition,
          } = rawOrderDetailOfDate;
          const { foodList: foodListOfDate } = restaurant;
          if (
            status === 'canceled' ||
            TRANSITIONS_TO_STATE_CANCELED.includes(lastTransition)
          ) {
            return result;
          }

          const foodDataMap = getFoodDataMap({ foodListOfDate, memberOrders });
          const foodDataList = Object.values(foodDataMap);
          const totalInfo = getTotalInfo(foodDataList);

          return {
            ...result,
            totalPrice: result.totalPrice + totalInfo.totalPrice,
            totalDishes: result.totalDishes + totalInfo.totalDishes,
            [dateKey]: foodDataList,
          };
        },
        {
          totalDishes: 0,
          totalPrice: 0,
        },
      )
    : Object.entries(orderDetail).reduce(
        (result, currentOrderDetailEntry) => {
          const [dateKey, rawOrderDetailOfDate] = currentOrderDetailEntry;
          const {
            lineItems = [],
            status,
            lastTransition,
          } = rawOrderDetailOfDate;

          if (
            (date && date?.toString() !== dateKey) ||
            status === 'canceled' ||
            TRANSITIONS_TO_STATE_CANCELED.includes(lastTransition)
          ) {
            return result;
          }
          const totalInfo = lineItems.reduce(
            (res, item) => {
              const { quantity = 1, price = 0 } = item || {};

              return {
                totalPrice: res.totalPrice + price,
                totalDishes: res.totalDishes + quantity,
              };
            },
            { totalPrice: 0, totalDishes: 0 },
          );
          const foodDataList = lineItems.map((item) => {
            return {
              foodName: item?.name,
              frequency: item?.quantity,
            };
          });

          return {
            ...result,
            totalPrice: result.totalPrice + totalInfo.totalPrice,
            totalDishes: result.totalDishes + totalInfo.totalDishes,
            [dateKey]: foodDataList,
          };
        },
        {
          totalDishes: 0,
          totalPrice: 0,
        },
      );
};

const calculatePriceQuotationInfoFromOrder = ({
  planOrderDetail = {},
  order,
  orderVATPercentage,
  orderServiceFeePercentage = 0,
  date,
  shouldIncludePITOFee = true,
  hasSpecificPCCFee = false,
  specificPCCFee = 0,
  isPartner = false,
  vatSetting = PARTNER_VAT_SETTINGS.vat,
}) => {
  const { packagePerMember = 0, orderType = ORDER_TYPES.group } =
    Listing(order).getMetadata();
  const isGroupOrder = orderType === ORDER_TYPES.group;

  const currentOrderDetail = Object.entries(planOrderDetail).reduce(
    (result, currentOrderDetailEntry) => {
      const [subOrderDate, rawOrderDetailOfDate] = currentOrderDetailEntry;
      const { status, lastTransition } = rawOrderDetailOfDate;

      if (
        status === 'canceled' ||
        TRANSITIONS_TO_STATE_CANCELED.includes(lastTransition)
      ) {
        return result;
      }

      return {
        ...result,
        [subOrderDate]: {
          ...rawOrderDetailOfDate,
        },
      };
    },
    {},
  );

  const PCCFee = Object.values(currentOrderDetail).reduce(
    (result, currentOrderDetailOfDate) => {
      const { memberOrders, lineItems = [] } = currentOrderDetailOfDate;
      const PCCFeeOfDate = calculatePCCFeeByDate({
        isGroupOrder,
        memberOrders,
        lineItems,
        hasSpecificPCCFee,
        specificPCCFee,
      });
      console.info('💫 > PCCFeeOfDate: ', PCCFeeOfDate);

      return result + PCCFeeOfDate;
    },
    0,
  );
  const actualPCCFee = shouldIncludePITOFee ? PCCFee : 0;
  console.info('💫 > shouldIncludePITOFee: ', shouldIncludePITOFee);
  console.info('💫 > actualPCCFee: ', actualPCCFee);
  const { totalPrice = 0, totalDishes = 0 } = calculateTotalPriceAndDishes({
    orderDetail: planOrderDetail,
    isGroupOrder,
    date,
  });
  console.info('💫 > totalPrice: ', totalPrice);

  const PITOPoints = Math.floor(totalPrice / 100000);
  const isOverflowPackage = totalDishes * packagePerMember < totalPrice;
  console.info('💫 > isOverflowPackage: ', isOverflowPackage);
  const serviceFee = date
    ? Math.round(totalPrice * orderServiceFeePercentage)
    : 0;
  const transportFee = 0;
  const promotion = 0;

  const PITOFee = actualPCCFee;
  const totalWithoutVAT =
    totalPrice - serviceFee + transportFee + PITOFee - promotion;
  console.info('💫 > totalWithoutVAT: ', totalWithoutVAT);
  // * VAT
  const vatPercentage = vatPercentageBaseOnVatSetting({
    vatSetting,
    vatPercentage: orderVATPercentage,
    isPartner,
  });
  console.info('💫 > orderVATPercentage: ', orderVATPercentage);
  console.info('💫 > vatPercentage: ', vatPercentage);
  const VATFee = calculateVATFee({
    vatPercentage,
    orderProvisionalPrice: totalWithoutVAT,
    orderMenuPrice: totalPrice,
    partnerVATSetting: vatSetting,
    target: isPartner ? 'partner' : 'customer',
  });
  console.info('💫 > VATFee: ', VATFee);

  const totalWithVAT = VATFee + totalWithoutVAT;
  console.info('💫 > totalWithVAT: ', totalWithVAT);
  const overflow = isOverflowPackage
    ? totalWithVAT - totalDishes * packagePerMember
    : 0;

  return {
    totalPrice,
    totalDishes,
    PITOPoints,
    VATFee: Math.abs(VATFee),
    vatPercentage: Math.abs(vatPercentage),
    totalWithVAT,
    serviceFee,
    transportFee,
    promotion,
    overflow,
    isOverflowPackage,
    totalWithoutVAT,
    PITOFee,
  };
};

const calculateTotalPriceCb = (singleDateSum, item) =>
  singleDateSum + item.foodPrice * item.frequency;

const calculatePriceQuotationPartner = ({
  quotation = {},
  serviceFeePercentage = 0,
  orderVATPercentage,
  subOrderDate,
  vatSetting = PARTNER_VAT_SETTINGS.vat,
}) => {
  const promotion = 0;
  const totalPrice = subOrderDate
    ? quotation[subOrderDate]?.reduce(calculateTotalPriceCb, 0)
    : Object.keys(quotation).reduce((result, orderDate) => {
        const totalPriceInDate = quotation[orderDate]?.reduce(
          calculateTotalPriceCb,
          0,
        );

        return result + totalPriceInDate;
      }, 0);

  const serviceFee = Math.round((totalPrice * serviceFeePercentage) / 100);
  const totalWithoutVAT = totalPrice - promotion - serviceFee;
  const vatPercentage = vatPercentageBaseOnVatSetting({
    vatSetting,
    vatPercentage: orderVATPercentage,
  });
  const VATFee = calculateVATFee({
    vatPercentage,
    orderProvisionalPrice: totalWithoutVAT,
    orderMenuPrice: totalPrice,
    partnerVATSetting: vatSetting,
    target: 'partner',
  });
  const totalWithVAT = VATFee + totalWithoutVAT;

  return {
    totalPrice,
    VATFee: Math.abs(VATFee),
    serviceFee,
    totalWithoutVAT,
    totalWithVAT,
    promotion,
    vatPercentage: Math.abs(vatPercentage),
  };
};

const calculatePriceQuotationInfoFromQuotation = ({
  quotation,
  packagePerMember,
  orderVATPercentage,
  orderServiceFeePercentage = 0,
  date,
  partnerId,
  hasSpecificPCCFee,
  specificPCCFee = 0,
  vatSetting = PARTNER_VAT_SETTINGS.vat,
  isPartner = false,
}) => {
  const quotationListingGetter = Listing(quotation);
  const { client, partner } = quotationListingGetter.getMetadata();
  if (isEmpty(client) || isEmpty(partner)) {
    return {};
  }

  const isPartnerFlow = date && partnerId;

  const clientQuotation = client.quotation;
  const partnerQuotation = isPartnerFlow
    ? pick(partner[partnerId]?.quotation || {}, date)
    : {};

  const {
    totalPrice = 0,
    totalDishes = 0,
    PITOFee = 0,
  } = Object.values(isPartnerFlow ? partnerQuotation : clientQuotation).reduce(
    (result, subOrder) => {
      const { subOrderTotalPrice, subOrderTotalDished } = subOrder.reduce(
        (subOrderResult, item) => {
          const { foodPrice, frequency } = item;

          return {
            subOrderTotalPrice:
              subOrderResult.subOrderTotalPrice + foodPrice * frequency,
            subOrderTotalDished: subOrderResult.subOrderTotalDished + frequency,
          };
        },
        {
          subOrderTotalPrice: 0,
          subOrderTotalDished: 0,
        },
      );

      const PCCFeeOfDate = hasSpecificPCCFee
        ? subOrderTotalDished > 0
          ? specificPCCFee
          : 0
        : getPCCFeeByMemberAmount(subOrderTotalDished);

      return {
        totalPrice: result.totalPrice + subOrderTotalPrice,
        totalDishes: result.totalDishes + subOrderTotalDished,
        PITOFee: isPartnerFlow ? 0 : result.PITOFee + PCCFeeOfDate,
      };
    },
    {
      totalPrice: 0,
      totalDishes: 0,
      PITOFee: 0,
    },
  );

  const PITOPoints = Math.floor(totalPrice / 100000);
  const isOverflowPackage = totalDishes * packagePerMember < totalPrice;
  const serviceFee = isPartnerFlow
    ? Math.round(orderServiceFeePercentage * totalPrice)
    : 0;
  const transportFee = 0;
  const promotion = 0;
  const totalWithoutVAT =
    totalPrice - serviceFee + transportFee + PITOFee - promotion;

  // * VAT
  const vatPercentage = vatPercentageBaseOnVatSetting({
    vatSetting,
    vatPercentage: orderVATPercentage,
    isPartner,
  });
  const VATFee = calculateVATFee({
    vatPercentage,
    orderProvisionalPrice: totalWithoutVAT,
    orderMenuPrice: totalPrice,
    partnerVATSetting: vatSetting,
    target: isPartner ? 'partner' : 'customer',
  });
  const totalWithVAT = VATFee + totalWithoutVAT;
  const overflow = isOverflowPackage
    ? totalWithVAT - totalDishes * packagePerMember
    : 0;

  return {
    totalPrice,
    totalDishes,
    PITOPoints,
    VATFee: Math.abs(VATFee),
    totalWithVAT,
    serviceFeePercentage: orderServiceFeePercentage * 100,
    serviceFee,
    transportFee,
    promotion,
    overflow,
    isOverflowPackage,
    totalWithoutVAT,
    PITOFee,
    vatPercentage: Math.abs(vatPercentage),
  };
};

const groupFoodForGroupOrder = (orderDetail, date) => {
  return Object.entries(orderDetail).reduce(
    (result, currentOrderDetailEntry, index) => {
      const [d, rawOrderDetailOfDate] = currentOrderDetailEntry;

      const {
        memberOrders,
        restaurant = {},
        status: subOrderStatus,
        lastTransition,
      } = rawOrderDetailOfDate;
      const { id, restaurantName, foodList: foodListOfDate = {} } = restaurant;
      if (
        subOrderStatus === 'canceled' ||
        TRANSITIONS_TO_STATE_CANCELED.includes(lastTransition) ||
        (date && d !== date.toString())
      ) {
        return result;
      }

      const foodDataMap = Object.entries(memberOrders).reduce(
        (foodFrequencyResult, currentMemberOrderEntry) => {
          const [, memberOrderData] = currentMemberOrderEntry;
          const { foodId, status, requirement = '' } = memberOrderData;
          const {
            foodName,
            foodPrice,
            foodUnit = '',
          } = foodListOfDate[foodId] || {};

          if (status === 'joined' && foodId !== '') {
            const data = foodFrequencyResult[foodId];
            const { frequency, notes = [] } = data || {};

            if (!isEmpty(requirement)) {
              notes.push(requirement);
            }

            return {
              ...foodFrequencyResult,
              [foodId]: data
                ? { ...data, frequency: frequency + 1, notes }
                : {
                    foodId,
                    foodName,
                    foodUnit,
                    foodPrice,
                    notes,
                    frequency: 1,
                  },
            };
          }

          return foodFrequencyResult;
        },
        {},
      );
      const foodDataList = Object.values(foodDataMap);
      const summary = foodDataList.reduce(
        (previousResult, current) => {
          const { totalPrice, totalDishes } = previousResult;
          const { frequency, foodPrice } = current;

          return {
            ...previousResult,
            totalDishes: totalDishes + frequency,
            totalPrice: totalPrice + foodPrice * frequency,
          };
        },
        {
          totalDishes: 0,
          totalPrice: 0,
          restaurantName,
        },
      );

      return [
        ...result,
        {
          date: d,
          index,
          ...summary,
          foodDataList,
          restaurantId: id,
        },
      ];
    },
    [],
  );
};

const groupFoodForNormal = (orderDetail, date) => {
  return Object.entries(orderDetail).reduce(
    (result, currentOrderDetailEntry, index) => {
      const [d, rawOrderDetailOfDate] = currentOrderDetailEntry;

      const {
        lineItems = [],
        restaurant = {},
        status: subOrderStatus,
        lastTransition,
      } = rawOrderDetailOfDate;
      const { id, restaurantName, foodList: foodListOfDate = {} } = restaurant;

      if (
        subOrderStatus === 'canceled' ||
        TRANSITIONS_TO_STATE_CANCELED.includes(lastTransition) ||
        (date && d !== date.toString())
      ) {
        return result;
      }

      const foodDataList = lineItems.map((lineItem) => {
        const {
          id: foodId,
          name: foodName,
          quantity = 1,
          unitPrice: foodPrice = 0,
        } = lineItem;
        const { foodUnit = '' } = foodListOfDate[foodId] || {};

        return { foodId, foodName, foodUnit, foodPrice, frequency: quantity };
      });

      const summary = lineItems.reduce(
        (previousResult, current) => {
          const { totalPrice, totalDishes } = previousResult;
          const { quantity = 1, price = 0 } = current;

          return {
            ...previousResult,
            totalDishes: totalDishes + quantity,
            totalPrice: totalPrice + price,
          };
        },
        {
          totalDishes: 0,
          totalPrice: 0,
          restaurantName,
        },
      );

      return [
        ...result,
        {
          date: d,
          index,
          ...summary,
          foodDataList,
          restaurantId: id,
        },
      ];
    },
    [],
  );
};

const groupFoodOrderByDate = ({
  orderDetail = {},
  isGroupOrder = true,
  date,
}) => {
  return isGroupOrder
    ? groupFoodForGroupOrder(orderDetail, date)
    : groupFoodForNormal(orderDetail, date);
};

module.exports = {
  ensureVATSetting,
  calculatePriceQuotationPartner,
  calculatePriceQuotationInfoFromOrder,
  calculatePriceQuotationInfoFromQuotation,
  checkIsOrderHasInProgressState,
  isEnableToCancelOrder,
  prepareNewPlanOrderDetail,
  getPickFoodParticipants,
  normalizeOrderDetail,
  groupFoodOrderByDate,
};
