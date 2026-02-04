import axios from 'axios';

import logger from '@helpers/logger';
import type { TMemberPlan } from '@redux/slices/shoppingCart.slice';
import { Listing, User } from '@src/utils/data';
import { formatTimestamp } from '@src/utils/dates';
import { ESlackNotificationType } from '@src/utils/enums';
import type { MissingOrderSlackNotificationBody } from '@src/utils/order';
import { editFoodTemplate } from '@src/utils/slackTemplates/editFood';
import { newFoodTemplate } from '@src/utils/slackTemplates/newFood';

import { fetchListing } from './integrationHelper';

function getUserTypeDataByUserType(userType: 'participant' | 'booker') {
  switch (userType) {
    case 'participant':
      return {
        label: 'Participant',
      };
    case 'booker':
      return {
        label: 'Booker',
      };
    default:
      return null;
  }
}

type SlackNotificationParams = {
  foodId?: string;
  restaurantId?: string;
  changeContent?: {
    [key: string]: {
      oldValue: any;
      newValue: any;
    };
  };
  orderStatusChangesToInProgressData?: {
    orderLink: string;
    orderName: string;
    companyName: string;
    startDate: string;
    deliveryHour: string;
    deliveryAddress: string;
    orderCode: string;
    planId: string;
  };
  deliveryAgentImagesUploadedData?: {
    orderLink: string;
    images: string[];
    threadTs?: string;
  };
  participantGroupOrderFoodChangedData?: {
    by: 'admin' | 'booker';
    threadTs: string;
    orderLink: string;
    orderCode: string;
    orderName: string;
    changes: {
      date: string;
      type: 'add' | 'remove' | 'update';
      fromFoodName?: string;
      toFoodName?: string;
      removeFoodName?: string;
      addFoodName?: string;
      participantName: string;
      restaurantName: string;
    }[];
  };
  participantNormalOrderFoodChangedData?: {
    by: 'admin' | 'booker';
    threadTs: string;
    orderLink: string;
    orderCode: string;
    orderName: string;
    changes: {
      date: string;
      foodName?: string;
      fromQuantity?: number;
      toQuantity?: number;
      type: 'add' | 'remove' | 'update';
    }[];
  };
  subOrderCanceledData?: {
    threadTs: string;
    orderLink: string;
    orderCode: string;
    orderName: string;
    date: string;
  };
  restaurantChangedData?: {
    threadTs: string;
    orderLink: string;
    orderCode: string;
    orderName: string;
    changes: {
      date: string;
      oldRestaurantName?: string;
      newRestaurantName?: string;
    }[];
  };
  partnerConfirmsSubOrderData?: {
    threadTs: string;
    orderLink: string;
    orderCode: string;
    orderName: string;
    date: string;
    partnerName: string;
  };
  partnerRejectsSubOrderData?: {
    threadTs: string;
    orderLink: string;
    orderCode: string;
    orderName: string;
    date: string;
    partnerName: string;
  };
  participantRatingData?: {
    ratingId?: string;
    ratingScore: number;
    content: string;
    images: string[];
    ratingUserName: string;
    partnerName: string;
    orderLink: string;
    orderCode: string;
    ratingUserType: 'participant' | 'booker';
    subDate?: number;
  };
  partnerReplyReviewData?: {
    reviewId: string;
    reviewLink: string;
    partnerName: string;
    replyContent: string;
    foodName: string;
    reviewerName: string;
    orderCode: string;
    threadTs?: string;
  };
  adminReplyReviewData?: {
    reviewId: string;
    reviewLink: string;
    replyContent: string;
    foodName: string;
    reviewerName: string;
    orderCode: string;
    threadTs?: string;
  };
  adminApprovePartnerReplyReviewData?: {
    reviewId: string;
    reviewLink: string;
    partnerName: string;
    threadTs?: string;
  };
  menuPublishedDraftToPendingData?: {
    menuName: string;
    restaurantName: string;
    menuLink: string;
  };
  adminApprovePartnerMenuData?: {
    menuName: string;
    restaurantName: string;
    menuLink: string;
  };
  adminRejectPartnerMenuData?: {
    menuName: string;
    restaurantName: string;
    menuLink: string;
  };
  participantPlaceOrderFailedData?: {
    orderId: string;
    planId: string;
    userOrder: TMemberPlan;
    error: string;
    userEmail: string;
  };
  handoverFoodChecklistData?: {
    companyName: string;
    recordedTime: Date | string | number;
    checklistLink: string;
    orderCode: string;
  };
};

export const createSlackNotification = async (
  notificationType: ESlackNotificationType,
  notificationParams: SlackNotificationParams,
) => {
  if (process.env.SLACK_WEBHOOK_ENABLED !== 'true') return;

  try {
    logger.info(
      'createSlackNotification',
      `notificationType: ${notificationType} ${JSON.stringify(
        notificationParams,
      )}`,
    );
    switch (notificationType) {
      case ESlackNotificationType.PARTICIPANT_RATING: {
        if (!notificationParams.participantRatingData) return;

        const userTypeData = getUserTypeDataByUserType(
          notificationParams.participantRatingData.ratingUserType,
        );

        if (!userTypeData) return;

        await axios.post(
          process.env.SLACK_RATING_WEBHOOK_URL,
          {
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `[${userTypeData.label}] ${
                    notificationParams.participantRatingData.ratingUserName
                  } đã đánh giá ${
                    notificationParams.participantRatingData.ratingScore
                  } :star: cho nhà hàng *${
                    notificationParams.participantRatingData.partnerName
                  }* trong đơn hàng *<${
                    notificationParams.participantRatingData.orderLink
                  }|#${notificationParams.participantRatingData.orderCode}>* ${
                    notificationParams.participantRatingData.subDate &&
                    `cho sub đơn *${formatTimestamp(
                      notificationParams.participantRatingData.subDate,
                    )}*`
                  }`,
                },
              },
              ...(notificationParams.participantRatingData.content
                ? [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `${notificationParams.participantRatingData.content}`,
                      },
                    },
                  ]
                : []),
              ...(notificationParams.participantRatingData.images
                ? notificationParams.participantRatingData.images.map(
                    (image) => ({
                      type: 'image',
                      image_url: image,
                      alt_text: 'Hình ảnh đánh giá',
                    }),
                  )
                : []),
            ],
            metadata: {
              event_type: ESlackNotificationType.PARTICIPANT_RATING,
              event_payload: {
                rating_id: notificationParams.participantRatingData.ratingId,
              },
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.CREATE_NEW_FOOD:
        {
          const { restaurantId, foodId } = notificationParams;

          if (!restaurantId || !foodId) return;

          const restaurant = await fetchListing(restaurantId);
          const food = await fetchListing(foodId);
          const restaurantListing = Listing(restaurant);
          const foodListing = User(food);
          const { title: foodName, createdAt } = foodListing.getAttributes();
          const { title: partnerName } = restaurantListing.getAttributes();
          const content = newFoodTemplate({
            restaurantId,
            foodId,
            partnerName,
            foodName,
            createdAt,
          });
          await axios.post(process.env.SLACK_WEBHOOK_URL, {
            text: content,
          });
        }
        break;
      case ESlackNotificationType.ORDER_STATUS_CHANGES_TO_IN_PROGRESS: {
        if (!notificationParams.orderStatusChangesToInProgressData) return;

        await axios.post(
          process.env.SLACK_WEBHOOK_URL,
          {
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<!channel> :firecracker::firecracker::firecracker: Bạn có đơn hàng đang triển khai:\n*<${notificationParams.orderStatusChangesToInProgressData.orderLink}|#${notificationParams.orderStatusChangesToInProgressData.orderCode} - ${notificationParams.orderStatusChangesToInProgressData.orderName}>*`,
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `*Khách hàng:*\n${notificationParams.orderStatusChangesToInProgressData.companyName}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Giao đến:*\n${notificationParams.orderStatusChangesToInProgressData.deliveryAddress}`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*Ngày bắt đầu:*\n${notificationParams.orderStatusChangesToInProgressData.startDate}`,
                  },

                  {
                    type: 'mrkdwn',
                    text: `*Giờ giao hàng:*\n${notificationParams.orderStatusChangesToInProgressData.deliveryHour}`,
                  },
                ],
              },
            ],
            metadata: {
              event_type:
                ESlackNotificationType.ORDER_STATUS_CHANGES_TO_IN_PROGRESS,
              event_payload: {
                plan_id:
                  notificationParams.orderStatusChangesToInProgressData.planId,
              },
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.DELIVERY_AGENT_IMAGES_UPLOADED: {
        if (!notificationParams.deliveryAgentImagesUploadedData) return;

        axios.post(
          process.env.SLACK_WEBHOOK_URL,
          {
            thread_ts:
              notificationParams.deliveryAgentImagesUploadedData.threadTs,
            reply_broadcast: true,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<!here> :dart::dart::dart: Tài xế đã cập nhật hình ảnh cho đơn hàng của bạn <${notificationParams.deliveryAgentImagesUploadedData.orderLink}|Truy cập>`,
                },
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        axios.post(
          process.env.SLACK_WEBHOOK_URL,
          {
            thread_ts:
              notificationParams.deliveryAgentImagesUploadedData.threadTs,
            blocks: [
              ...(notificationParams.deliveryAgentImagesUploadedData?.images
                ? (
                    notificationParams.deliveryAgentImagesUploadedData
                      ?.images || []
                  ).map((image) => ({
                    type: 'image',
                    image_url: image,
                    alt_text: 'Hình ảnh tài xế đã tải lên',
                  }))
                : []),
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.PARTICIPANT_GROUP_ORDER_FOOD_CHANGED: {
        const { participantGroupOrderFoodChangedData } = notificationParams;
        if (!participantGroupOrderFoodChangedData) return;
        if (!participantGroupOrderFoodChangedData.changes.length) return;

        await axios.post(
          process.env.SLACK_WEBHOOK_URL,
          {
            thread_ts: participantGroupOrderFoodChangedData.threadTs,
            reply_broadcast: true,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<!here> :gear::gear::gear: Đơn hàng có thay đổi khi đang diễn ra:\n*<${participantGroupOrderFoodChangedData.orderLink}|#${participantGroupOrderFoodChangedData.orderCode} - ${participantGroupOrderFoodChangedData.orderName}>*`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:person_in_tuxedo: Người thay đổi\n*${
                    participantGroupOrderFoodChangedData.by === 'admin'
                      ? 'Admin'
                      : 'Booker'
                  }*`,
                },
              },
              ...participantGroupOrderFoodChangedData.changes.map((change) => {
                return {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `[${change.date}] :person_in_tuxedo: Đối tác *[${
                      change.restaurantName
                    }]* Participant *[${change.participantName}]* ${
                      (change.type === 'remove' &&
                        `:x: Xóa phần ăn *[${change.removeFoodName}]*`) ||
                      (change.type === 'add' &&
                        `:large_green_square: Thêm phần ăn *[${change.addFoodName}]*`) ||
                      (change.type === 'update' &&
                        `:pencil: Thay đổi từ *[${change.fromFoodName}]* thành *[${change.toFoodName}]*`) ||
                      ''
                    }`,
                  },
                };
              }),
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.PARTICIPANT_NORMAL_ORDER_FOOD_CHANGED: {
        const { participantNormalOrderFoodChangedData } = notificationParams;
        if (!participantNormalOrderFoodChangedData) return;
        if (!participantNormalOrderFoodChangedData.changes.length) return;

        await axios.post(
          process.env.SLACK_WEBHOOK_URL,
          {
            thread_ts: participantNormalOrderFoodChangedData.threadTs,
            reply_broadcast: true,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<!here> :gear::gear::gear: Đơn hàng có thay đổi khi đang diễn ra:\n*<${participantNormalOrderFoodChangedData.orderLink}|#${participantNormalOrderFoodChangedData.orderCode} - ${participantNormalOrderFoodChangedData.orderName}>*`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:person_in_tuxedo: Người thay đổi\n*${
                    participantNormalOrderFoodChangedData?.by === 'admin'
                      ? 'Admin'
                      : 'Booker'
                  }*`,
                },
              },
              ...participantNormalOrderFoodChangedData.changes.map((change) => {
                return {
                  type: 'section',
                  fields: [
                    {
                      type: 'mrkdwn',
                      text: `[${change.date}]`,
                    },
                    (change.type === 'remove' && {
                      type: 'mrkdwn',
                      text: `:x: Xóa phần ăn *${change.foodName}*`,
                    }) ||
                      (change.type === 'add' && {
                        type: 'mrkdwn',
                        text: `:large_green_square: Thêm phần ăn\n*${change.foodName}*`,
                      }) ||
                      (change.type === 'update' && {
                        type: 'mrkdwn',
                        text: `:pencil: Thay đổi số lượng\nTừ *${change.fromQuantity}* thành *${change.toQuantity}*`,
                      }) ||
                      {},
                  ],
                };
              }),
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.RESTAURANT_CHANGED: {
        const { restaurantChangedData } = notificationParams;
        if (!restaurantChangedData) return;
        if (!restaurantChangedData.changes.length) return;

        await axios.post(
          process.env.SLACK_WEBHOOK_URL,
          {
            thread_ts: restaurantChangedData.threadTs,
            reply_broadcast: true,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<!here> :truck::truck::truck: Đơn hàng đã thay đổi nhà hàng:\n*<${restaurantChangedData.orderLink}|#${restaurantChangedData.orderCode} - ${restaurantChangedData.orderName}>*`,
                },
              },
              ...restaurantChangedData.changes.map((change) => {
                return {
                  type: 'section',
                  fields: [
                    {
                      type: 'mrkdwn',
                      text: `:house: Nhà hàng cũ\n*${change.oldRestaurantName}*`,
                    },
                    {
                      type: 'mrkdwn',
                      text: `:house_with_garden: Nhà hàng mới\n*${change.newRestaurantName}*`,
                    },
                    {
                      type: 'mrkdwn',
                      text: `:clock1: Ngày\n*${change.date}*`,
                    },
                  ],
                };
              }),
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.SUB_ORDER_CANCELED: {
        const { subOrderCanceledData } = notificationParams;
        if (!subOrderCanceledData) return;

        await axios.post(
          process.env.SLACK_WEBHOOK_URL,
          {
            thread_ts: subOrderCanceledData.threadTs,
            reply_broadcast: true,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<!here> :x::x::x: Sub đơn bị hủy:\n*<${subOrderCanceledData.orderLink}|#${subOrderCanceledData.orderCode} - ${subOrderCanceledData.orderName}>*`,
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `:clock1: Ngày\n*${subOrderCanceledData.date}*`,
                  },
                ],
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.PARTNER_CONFIRMS_SUB_ORDER: {
        const { partnerConfirmsSubOrderData } = notificationParams;
        if (!partnerConfirmsSubOrderData) return;

        await axios.post(
          process.env.SLACK_WEBHOOK_URL,
          {
            thread_ts: partnerConfirmsSubOrderData.threadTs,
            reply_broadcast: true,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<!here> :white_check_mark::white_check_mark::white_check_mark: Đối tác đã xác nhận sub đơn:\n*<${partnerConfirmsSubOrderData.orderLink}|#${partnerConfirmsSubOrderData.orderCode} - ${partnerConfirmsSubOrderData.orderName}>*`,
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `:clock1: Ngày\n*${partnerConfirmsSubOrderData.date}*`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `:house: Nhà hàng\n*${partnerConfirmsSubOrderData.partnerName}*`,
                  },
                ],
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.PARTNER_REJECTS_SUB_ORDER: {
        const { partnerRejectsSubOrderData } = notificationParams;
        if (!partnerRejectsSubOrderData) return;

        await axios.post(
          process.env.SLACK_WEBHOOK_URL,
          {
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<!here> :x::x::x: Đối tác đã từ chối sub đơn:\n*<${partnerRejectsSubOrderData.orderLink}|#${partnerRejectsSubOrderData.orderCode} - ${partnerRejectsSubOrderData.orderName}>*`,
                },
              },
              {
                type: 'section',
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `:clock1: Ngày\n*${partnerRejectsSubOrderData.date}*`,
                  },
                  {
                    type: 'mrkdwn',
                    text: `:house: Nhà hàng\n*${partnerRejectsSubOrderData.partnerName}*`,
                  },
                ],
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.UPDATE_FOOD:
        {
          const {
            restaurantId,
            foodId,
            changeContent = {},
          } = notificationParams;

          if (!restaurantId || !foodId) return;

          const restaurant = await fetchListing(restaurantId);
          const food = await fetchListing(foodId);
          const restaurantListing = Listing(restaurant);
          const foodListing = User(food);
          const { title: foodName } = foodListing.getAttributes();
          const { title: partnerName } = restaurantListing.getAttributes();

          const { title, foodType, images, description, price, sideDishes } =
            changeContent;
          const content = editFoodTemplate({
            restaurantId,
            foodId,
            partnerName,
            foodName,
            title,
            foodType,
            images,
            description,
            price,
            sideDishes,
          });
          await axios.post(process.env.SLACK_WEBHOOK_URL, {
            text: content,
          });
        }
        break;
      case ESlackNotificationType.PARTICIPANT_ORDER_PERSISTENCE_FAILED: {
        const payload: MissingOrderSlackNotificationBody =
          notificationParams as MissingOrderSlackNotificationBody;
        const {
          orderCode,
          orderName,
          planId,
          userId,
          userName,
          actions = [],
          expected,
          actual,
          failedAt,
          service,
          error,
          threadTs,
          metrics,
          diffTable = [],
        } = payload || {};

        const truncate = (s: string, n = 1400) =>
          s && s.length > n ? `${s.slice(0, n)}...` : s;

        const actionsList = Array.isArray(actions)
          ? actions
              .map((a: any, i: number) => {
                const actionName =
                  a.type === 'changeFood'
                    ? `:pencil: Đổi món`
                    : a.type === 'addFood'
                    ? `:heavy_plus_sign: Thêm món`
                    : a.type === 'removeFood'
                    ? `:x: Xóa món`
                    : a.type === 'changeRequirement'
                    ? `:memo: Yêu cầu`
                    : `:gear: ${a.type}`;
                const foodLabel =
                  a.fromFoodName || a.fromFoodId
                    ? `(${a.fromFoodName || a.fromFoodId} → ${
                        a.toFoodName || a.foodName || a.foodId || ''
                      })`
                    : a.foodName || a.foodId || '';
                const req = a.requirement ? ` (req: ${a.requirement})` : '';

                return `${i + 1}. [${a.time}] ${actionName} - ${
                  formatTimestamp(a.date) || ''
                } ${foodLabel}${req}`;
              })
              .join('\n')
          : 'N/A';

        const expectedStr = expected
          ? truncate(JSON.stringify(expected, null, 2))
          : '';
        const actualStr = actual
          ? truncate(JSON.stringify(actual, null, 2))
          : '';

        await axios.post(
          process.env.SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL,
          {
            ...(threadTs ? { thread_ts: threadTs, reply_broadcast: true } : {}),
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: '[WARNING :warning: :warning: :warning:] Cảnh báo mất món ở Participant',
                },
              },
              { type: 'divider' },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Đơn hàng*: <#${orderCode} - ${orderName}>`,
                },
                fields: [
                  { type: 'mrkdwn', text: `*Plan ID*\n${planId || 'N/A'}` },
                  { type: 'mrkdwn', text: `*User*\n${userName} - #${userId}` },
                  { type: 'mrkdwn', text: `*Bước lỗi*\n${failedAt || 'N/A'}` },
                  { type: 'mrkdwn', text: `*Service*\n${service || 'N/A'}` },
                  ...(metrics
                    ? [
                        {
                          type: 'mrkdwn',
                          text: `*Queue*\nwaiting=${metrics.waiting} active=${metrics.active}`,
                        },
                      ]
                    : []),
                ],
              },
              { type: 'divider' },
              ...(actions && actions.length
                ? [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*Hành vi người dùng*\n${actionsList}`,
                      },
                    },
                    { type: 'divider' },
                  ]
                : []),
              ...(diffTable && diffTable.length
                ? [
                    { type: 'divider' },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: '*Đối chiếu Expected vs Actual (theo ngày)*',
                      },
                    },
                    ...diffTable.slice(0, 10).map((row: any) => ({
                      type: 'section',
                      fields: [
                        { type: 'mrkdwn', text: `*Ngày*\n${row.date}` },
                        {
                          type: 'mrkdwn',
                          text: `*Expected*\n${
                            row.expected.foodName || row.expected.foodId || '-'
                          } | ${row.expected.status || '-'}$${
                            row.expected.requirement
                              ? `\n(req: ${row.expected.requirement})`
                              : ''
                          }`,
                        },
                        {
                          type: 'mrkdwn',
                          text: `*Actual*\n${
                            row.actual.foodName || row.actual.foodId || '-'
                          } | ${row.actual.status || '-'}$${
                            row.actual.requirement
                              ? `\n(req: ${row.actual.requirement})`
                              : ''
                          }`,
                        },
                      ],
                    })),
                  ]
                : expectedStr || actualStr
                ? [
                    { type: 'divider' },
                    ...(expectedStr
                      ? [
                          {
                            type: 'section',
                            text: {
                              type: 'mrkdwn',
                              text: `*Expected (client gửi)*\n\n\`${expectedStr}\``,
                            },
                          },
                        ]
                      : []),
                    ...(actualStr
                      ? [
                          {
                            type: 'section',
                            text: {
                              type: 'mrkdwn',
                              text: `*Actual (DB ghi nhận)*\n\n\`${actualStr}\``,
                            },
                          },
                        ]
                      : []),
                  ]
                : []),
              ...(error
                ? [
                    { type: 'divider' },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*Error*\n\`${String(error)}\``,
                      },
                    },
                  ]
                : []),
            ],
          },
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );
        break;
      }

      case ESlackNotificationType.PARTNER_REPLY_REVIEW: {
        if (!notificationParams.partnerReplyReviewData) return;

        const {
          reviewLink,
          partnerName,
          replyContent,
          foodName,
          reviewerName,
          orderCode,
          threadTs,
        } = notificationParams.partnerReplyReviewData;

        await axios.post(
          process.env.SLACK_RATING_WEBHOOK_URL,
          {
            ...(threadTs ? { thread_ts: threadTs } : {}),
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:speech_balloon: *Nhà hàng ${partnerName}* đã phản hồi đánh giá của *${reviewerName}* về món *${foodName}* trong đơn hàng *#${orderCode}*. Vui lòng xem và duyệt phản hồi.`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Nội dung phản hồi:*\n${replyContent}`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<${reviewLink}|Xem và duyệt phản hồi>`,
                },
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.ADMIN_REPLY_REVIEW: {
        if (!notificationParams.adminReplyReviewData) return;

        const {
          reviewLink,
          replyContent,
          foodName,
          orderCode,
          reviewerName,
          threadTs,
        } = notificationParams.adminReplyReviewData;

        await axios.post(
          process.env.SLACK_RATING_WEBHOOK_URL,
          {
            ...(threadTs ? { thread_ts: threadTs } : {}),
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:speech_balloon: *PITO Cloud Canteen* đã phản hồi đánh giá của *${reviewerName}* về món *${foodName}* trong đơn hàng *#${orderCode}*`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Nội dung phản hồi:*\n${replyContent}`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<${reviewLink}|Xem đánh giá>`,
                },
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.ADMIN_APPROVE_PARTNER_REPLY_REVIEW: {
        if (!notificationParams.adminApprovePartnerReplyReviewData) return;

        const { reviewLink, partnerName, threadTs } =
          notificationParams.adminApprovePartnerReplyReviewData;

        await axios.post(
          process.env.SLACK_RATING_WEBHOOK_URL,
          {
            ...(threadTs ? { thread_ts: threadTs } : {}),
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:speech_balloon: *Admin đã duyệt phản hồi của nhà hàng ${partnerName}*`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<${reviewLink}|Xem phản hồi>`,
                },
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.PARTNER_MENU_PUBLISHED_DRAFT_TO_PENDING: {
        if (!notificationParams.menuPublishedDraftToPendingData) return;

        const { menuName, restaurantName, menuLink } =
          notificationParams.menuPublishedDraftToPendingData;
        await axios.post(
          process.env.SLACK_PARTNER_WEBHOOK_URL,
          {
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:gear::gear::gear: Menu *${menuName}* của nhà hàng *${restaurantName}* đã được tạo và đang chờ duyệt`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<${menuLink}|Xem menu và duyệt>`,
                },
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.ADMIN_APPROVE_PARTNER_MENU: {
        if (!notificationParams.adminApprovePartnerMenuData) return;

        const { menuName, restaurantName, menuLink } =
          notificationParams.adminApprovePartnerMenuData;

        await axios.post(
          process.env.SLACK_PARTNER_WEBHOOK_URL,
          {
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:white_check_mark: Menu *${menuName}* của nhà hàng *${restaurantName}* đã được admin duyệt`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<${menuLink}|Xem menu>`,
                },
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        break;
      }

      case ESlackNotificationType.ADMIN_REJECT_PARTNER_MENU: {
        if (!notificationParams.adminRejectPartnerMenuData) return;

        const { menuName, restaurantName, menuLink } =
          notificationParams.adminRejectPartnerMenuData;

        await axios.post(
          process.env.SLACK_PARTNER_WEBHOOK_URL,
          {
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:warning: Menu *${menuName}* của nhà hàng *${restaurantName}* bị admin từ chối duyệt`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `<${menuLink}|Xem menu>`,
                },
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        break;
      }

      case ESlackNotificationType.PARTICIPANT_PLACE_ORDER_FAILED: {
        if (!notificationParams.participantPlaceOrderFailedData) return;

        const { orderId, planId, userOrder, error, userEmail } =
          notificationParams.participantPlaceOrderFailedData;
        await axios.post(
          process.env.SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL,
          {
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `:warning: Đơn hàng *#${orderId}* của plan *${planId}* bị lỗi khi đặt món`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Người dùng:*\n${userEmail}`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Lỗi:*\n${JSON.stringify(error)}`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*User Order:*\n${JSON.stringify(userOrder)}`,
                },
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }

      case ESlackNotificationType.HANDOVER_FOOD_CHECKLIST: {
        if (!notificationParams.handoverFoodChecklistData) return;

        const { companyName, recordedTime, checklistLink, orderCode } =
          notificationParams.handoverFoodChecklistData;

        // Format recordedTime to "HH:mm:ss d/M/yyyy"
        const formattedTime = formatTimestamp(
          typeof recordedTime === 'string'
            ? new Date(recordedTime).getTime()
            : typeof recordedTime === 'number'
            ? recordedTime
            : recordedTime.getTime(),
          'HH:mm:ss d/M/yyyy',
        );

        await axios.post(
          process.env.SLACK_WEBHOOK_URL,
          {
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: ':heart: *Miễn trừ trách nhiệm thức ăn sau phục vụ*',
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${companyName}* đã xác nhận biên bản bàn giao thức ăn sau thời gian phục vụ lúc: *${formattedTime}*`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `  • *Mã đơn hàng:* ${orderCode}`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `  • *Biên bản đã ký:* <${checklistLink}|Xem biên bản>`,
                },
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        break;
      }
      default:
        break;
    }
  } catch (error) {
    logger.error('createSlackNotification', String(error));
  }
};
