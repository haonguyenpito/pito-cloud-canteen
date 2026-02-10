import { isUserAParticipant } from '@helpers/user';
import type { TNativeNotificationPartnerParams } from '@src/types/nativeNotificationParams';
import { Listing, User } from '@src/utils/data';
import { formatTimestamp } from '@src/utils/dates';
import {
  EBookerNativeNotificationType,
  ECompanyPermission,
  ENativeNotificationType,
} from '@src/utils/enums';
import { getFullName } from '@src/utils/string';
import type { TListing, TUser } from '@src/utils/types';

import { fetchUser } from './integrationHelper';
import { sendNotification } from './oneSignal';

type NativeNotificationParams = {
  order?: TListing;
  participantId: string;
  foodName?: string;
  planId?: string;
  subOrderDate?: string;
  reviewId?: string;
  replyContent?: string;
  partnerName?: string;
  companyId?: string;
};
const BASE_URL = process.env.NEXT_PUBLIC_CANONICAL_URL;

export const createNativeNotification = async (
  notificationType: ENativeNotificationType,
  notificationParams: NativeNotificationParams,
) => {
  const { participantId } = notificationParams;

  const participant = await fetchUser(participantId);

  if (!participant) return;

  const participantUser = User(participant);
  const profile = participantUser.getProfile();

  const fullName = getFullName(profile);

  const { oneSignalUserIds = [] } = participantUser.getPrivateData();
  const { isPartner } = participantUser.getMetadata();

  const isParticipant = isUserAParticipant(participant);

  const allowedToSend = isParticipant || isPartner;

  if (!allowedToSend) return;

  if (oneSignalUserIds.length === 0) return;

  switch (notificationType) {
    case ENativeNotificationType.BookerTransitOrderStateToPicking:
      {
        const { order } = notificationParams;
        const orderListing = Listing(order!);
        const orderId = orderListing.getId();
        const { startDate, endDate } = orderListing.getMetadata();
        const url = `${BASE_URL}/participant/order/${orderId}/?subOrderDate=${startDate}&viewMode=week`;
        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: `Bạn muốn ăn gì nào 🤔 ?`,
            content: `Tuần ăn ${formatTimestamp(
              +startDate,
              'dd/MM',
            )}-${formatTimestamp(
              +endDate,
              'dd/MM',
            )} đã sẵn sàng, mời ${fullName} chọn món nhé!`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;
    case ENativeNotificationType.BookerTransitOrderStateToInProgress:
      {
        const { order } = notificationParams;
        const orderListing = Listing(order!);
        const orderId = orderListing.getId();
        const { startDate, endDate } = orderListing.getMetadata();
        const url = `${BASE_URL}/participant/order/${orderId}/?subOrderDate=${startDate}&viewMode=week`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: 'Tuần ăn đã đặt',
            content: `Tuần ăn ${formatTimestamp(
              +startDate,
              'dd/MM',
            )}-${formatTimestamp(
              +endDate,
              'dd/MM',
            )} của ${fullName} được đặt thành công`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;
    case ENativeNotificationType.AdminTransitSubOrderToDelivered:
      {
        const { foodName, planId, subOrderDate } = notificationParams;
        const url = `${BASE_URL}/participant/orders/?planId=${planId}&timestamp=${subOrderDate}&viewMode=week`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: 'Đã có cơm 😍 😍 😍',
            content: `${foodName} đã được giao đến bạn. Chúc ${fullName} ngon miệng.`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;
    case ENativeNotificationType.AdminTransitSubOrderToCanceled:
      {
        const { planId, subOrderDate } = notificationParams;
        const url = `${BASE_URL}/participant/orders/?planId=${planId}&timestamp=${subOrderDate}&viewMode=week`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: 'Opps! Ngày ăn bị hủy!',
            content: `😢 ${fullName} ơi, rất tiếc phải thông báo ngày ăn ${formatTimestamp(
              +subOrderDate!,
              'dd/MM',
            )} đã bị hủy`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;
    case ENativeNotificationType.TransitOrderStateToCanceled:
      {
        const { order, planId } = notificationParams;
        const orderListing = Listing(order!);
        const { startDate, endDate } = orderListing.getMetadata();
        const url = `${BASE_URL}/participant/orders/?planId=${planId}&timestamp=${startDate}&viewMode=week`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: 'Opps! Tuần ăn bị hủy!',
            content: `😢 ${fullName} ơi, rất tiếc phải thông báo tuần ăn ${formatTimestamp(
              +startDate!,
              'dd/MM',
            )}-${formatTimestamp(+endDate!, 'dd/MM')} đã bị hủy`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    case ENativeNotificationType.AdminReplyReview:
      {
        const { foodName } = notificationParams;
        const url = `${BASE_URL}/participant/sub-orders?tab=rating-history`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: '💬 Có phản hồi mới về đánh giá của bạn',
            content: `PITO Cloud Canteen đã phản hồi về đánh giá của bạn cho món ${
              foodName || 'món ăn'
            }. Nhấn để xem chi tiết!`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    case ENativeNotificationType.AdminApprovePartnerReplyReview:
      {
        const { foodName, partnerName } = notificationParams;
        const url = `${BASE_URL}/participant/sub-orders?tab=rating-history`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: '💬 Nhà hàng đã phản hồi đánh giá của bạn',
            content: `${
              partnerName || 'Nhà hàng'
            } đã phản hồi về đánh giá của bạn cho món ${
              foodName || 'món ăn'
            }. Nhấn để xem chi tiết!`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    case ENativeNotificationType.Events:
      {
        const url = `${BASE_URL}/participant/events/mens-day`;
        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: "Happy Men's Day!",
            content:
              'Quà tặng voucher 100k dành riêng cho anh. Chạm để mở quà ngay!',
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    case ENativeNotificationType.Tet2026:
      {
        const { companyId } = notificationParams;
        const url = `${BASE_URL}/participant/tet-2026/${companyId}`;
        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: 'Happy Tet 2026!',
            content: 'Năm mới đến rồi, chúc mừng bạn năm mới vui vẻ!',
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    default:
      break;
  }
};

export const createNativeNotificationToPartner = async (
  notificationType: ENativeNotificationType,
  notificationParams: TNativeNotificationPartnerParams,
) => {
  const { partner } = notificationParams;
  const partnerUser = User(partner);
  const { isPartner } = partnerUser.getMetadata();
  if (!isPartner) return;
  const { oneSignalUserIds = [] } = partnerUser.getPrivateData();

  if (oneSignalUserIds.length === 0) return;

  switch (notificationType) {
    case ENativeNotificationType.BookerTransitOrderStateToInProgress:
      {
        const { order, subOrderDate } = notificationParams;
        const orderListing = Listing(order!);
        const orderId = orderListing.getId();
        const { deliveryHour } = orderListing.getMetadata();
        const deliveryStartHour = deliveryHour.split('-')[0];
        const url = `${BASE_URL}/partner/orders/${orderId}_${subOrderDate}`;

        const oneSingals: Promise<any>[] = [];
        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          oneSingals.push(
            sendNotification({
              title: '😍Bạn có một đơn hàng mới!',
              content: `Bạn có đơn hàng cần triển khai vào ${deliveryStartHour}, ${formatTimestamp(
                +subOrderDate!,
                'dd/MM/yyyy',
              )}. Nhấn để xác nhận đơn.`,
              url,
              oneSignalUserId,
            }),
          );
        });

        await Promise.allSettled(oneSingals);
      }
      break;

    case ENativeNotificationType.TransitOrderStateToCanceled:
    case ENativeNotificationType.AdminTransitSubOrderToCanceled:
      {
        const { order, subOrderDate } = notificationParams;
        const orderListing = Listing(order!);
        const orderId = orderListing.getId();
        const { deliveryHour } = orderListing.getMetadata();
        const deliveryStartHour = deliveryHour.split('-')[0];
        const url = `${BASE_URL}/partner/orders/${orderId}_${subOrderDate}`;

        const oneSingals: Promise<any>[] = [];
        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          oneSingals.push(
            sendNotification({
              title: '😢Rất tiếc! Một đơn hàng vừa bị huỷ!',
              content: `Đơn hàng vào lúc ${deliveryStartHour}, ${formatTimestamp(
                +subOrderDate!,
                'dd/MM/yyyy',
              )} vừa bị huỷ. Nhấn để xem chi tiết.`,
              url,
              oneSignalUserId,
            }),
          );
        });
        await Promise.allSettled(oneSingals);
      }
      break;
    case ENativeNotificationType.AdminUpdateOrder:
      {
        const { order, subOrderDate } = notificationParams;
        const orderListing = Listing(order!);
        const orderId = orderListing.getId();
        const { deliveryHour } = orderListing.getMetadata();
        const deliveryStartHour = deliveryHour.split('-')[0];
        const url = `${BASE_URL}/partner/orders/${orderId}_${subOrderDate}`;

        const oneSingals: Promise<any>[] = [];
        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          oneSingals.push(
            sendNotification({
              title: 'Đơn hàng có sự thay đổi!',
              content: `Đơn hàng vào lúc ${deliveryStartHour}, ${formatTimestamp(
                +subOrderDate!,
                'dd/MM/yyyy',
              )} vừa được chỉnh sửa. Nhấn để cập nhật chi tiết.`,
              url,
              oneSignalUserId,
            }),
          );
        });
        await Promise.allSettled(oneSingals);
      }
      break;
    case ENativeNotificationType.AdminTransitFoodStateToApprove:
      {
        const { foodId, foodName } = notificationParams;
        const url = `${BASE_URL}/partner/products/food/${foodId}/?fromTab=accepted`;

        const oneSingals: Promise<any>[] = [];
        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          oneSingals.push(
            sendNotification({
              title: '😍😍Tuyệt vời! Món ăn đã được duyệt!',
              content: `Món ăn ${foodName} đã được duyệt. Nhấn vào để xem chi tiết`,
              url,
              oneSignalUserId,
            }),
          );
        });
        await Promise.allSettled(oneSingals);
      }
      break;
    case ENativeNotificationType.AdminTransitFoodStateToReject:
      {
        const { foodId, foodName } = notificationParams;
        const url = `${BASE_URL}/partner/products/food/${foodId}/?fromTab=accepted`;

        const oneSingals: Promise<any>[] = [];
        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          oneSingals.push(
            sendNotification({
              title: '😢Opps! Món ăn bị từ chối duyệt!',
              content: `Rất tiếc, món ${foodName} bị từ chối duyệt. Nhấn vào để xem lý do!`,
              url,
              oneSignalUserId,
            }),
          );
        });
        await Promise.allSettled(oneSingals);
      }
      break;
    case ENativeNotificationType.AdminChangePartnerInformation:
      {
        const { partnerName } = notificationParams;

        const url = `${BASE_URL}/partner/settings/account/info`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: `Thông tin ${partnerName} đã được chỉnh sửa`,
            content: `Thông tin thương hiệu của bạn đã được chỉnh sửa. Nhấn để xem chi tiết.`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    case ENativeNotificationType.AdminApprovePartnerMenu: {
      const { menuId, menuName, partnerName } = notificationParams;
      const url = `${BASE_URL}/partner/products/menu/${menuId}`;

      const oneSignals: Promise<void>[] = [];
      oneSignalUserIds.forEach((oneSignalUserId: string) => {
        oneSignals.push(
          sendNotification({
            title: '😍 Menu đã được duyệt!',
            content: `Menu ${menuName || ''} của ${
              partnerName || 'bạn'
            } đã được duyệt. Nhấn để xem chi tiết.`,
            url,
            oneSignalUserId,
          }),
        );
      });
      await Promise.allSettled(oneSignals);
      break;
    }

    case ENativeNotificationType.AdminRejectPartnerMenu: {
      const { menuId, menuName, partnerName, rejectedReason } =
        notificationParams;
      const url = `${BASE_URL}/partner/products/menu/${menuId}`;

      const oneSignals: Promise<void>[] = [];
      oneSignalUserIds.forEach((oneSignalUserId: string) => {
        oneSignals.push(
          sendNotification({
            title: '😢 Menu chưa được duyệt',
            content: `Menu ${menuName || ''} của ${
              partnerName || 'bạn'
            } bị từ chối${
              rejectedReason ? `: ${rejectedReason}` : ''
            }. Nhấn để xem chi tiết.`,
            url,
            oneSignalUserId,
          }),
        );
      });
      await Promise.allSettled(oneSignals);
      break;
    }

    case ENativeNotificationType.PartnerSubOrderNegativeRating:
      {
        const { subOrderDate } = notificationParams;
        const url = `${BASE_URL}/partner/reviews?rating=1,2`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: '😢 Bạn vừa nhận được một đánh giá tiêu cực',
            content: `Đơn hàng ngày ${formatTimestamp(
              +subOrderDate!,
              'dd/MM/yyyy',
            )} vừa nhận được một đánh giá tiêu cực từ khách hàng. Nhấn để xem chi tiết!`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    default:
      break;
  }
};

type NativeNotificationBookerParams = {
  booker: TUser;
  order?: TListing;
  subOrderDate?: string;
};

export const createNativeNotificationToBooker = async (
  notificationType: EBookerNativeNotificationType,
  notificationParams: NativeNotificationBookerParams,
) => {
  const { booker } = notificationParams;
  const bookerUser = User(booker);
  const { isCompany, company } = bookerUser.getMetadata();
  const { displayName } = bookerUser.getProfile();

  const isBooker = Object.values(company).some(({ permission }: any) => {
    return permission === ECompanyPermission.booker;
  });

  if (!isCompany && !isBooker) return;

  const { oneSignalUserIds = [] } = bookerUser.getPrivateData();

  if (oneSignalUserIds.length === 0) return;

  switch (notificationType) {
    case EBookerNativeNotificationType.AdminCreateNewOrder:
      {
        const { order } = notificationParams;
        const orderListing = Listing(order!);
        const orderId = orderListing.getId();

        const url = `${BASE_URL}/company/booker/orders/draft/${orderId}?userRole=booker`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: `Có đơn hàng mới ✨`,
            content:
              'Ting ting! Bạn vừa nhận được một đơn hàng mới tạo bởi PITO',
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    case EBookerNativeNotificationType.AdminStartOrder:
      {
        const { order } = notificationParams;
        const orderListing = Listing(order!);
        const orderId = orderListing.getId();
        const { startDate, endDate } = orderListing.getMetadata();

        const url = `${BASE_URL}/company/orders/${orderId}?userRole=booker`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: `Tuần ăn đã đặt 🌟`,
            content: `Tuần ăn ${formatTimestamp(
              startDate,
              'dd/MM',
            )} -${formatTimestamp(endDate, 'dd/MM')} đã được đặt thành công.`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    case EBookerNativeNotificationType.SubOrderCancelled:
      {
        const { order, subOrderDate } = notificationParams;
        const orderListing = Listing(order!);
        const orderId = orderListing.getId();

        const url = `${BASE_URL}/company/orders/${orderId}?userRole=booker`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: `Opps! Ngày ăn bị hủy! 😢`,
            content: `${displayName} ơi, rất tiếc phải thông báo ngày ăn ${formatTimestamp(
              +subOrderDate!,
              'dd/MM',
            )} đã bị hủy`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    case EBookerNativeNotificationType.SubOrderDelivering:
      {
        const { order, subOrderDate } = notificationParams;
        const orderListing = Listing(order!);
        const orderId = orderListing.getId();

        const url = `${BASE_URL}/company/orders/${orderId}?userRole=booker`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: `Cơm sắp đến 🚚`,
            content: `Ngày ăn ${formatTimestamp(
              +subOrderDate!,
              'dd/MM',
            )} sắp đến rồi. Chuẩn bị ăn thôi!!`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    case EBookerNativeNotificationType.SubOrderDelivered:
      {
        const { order, subOrderDate } = notificationParams;
        const orderListing = Listing(order!);
        const orderId = orderListing.getId();

        const url = `${BASE_URL}/company/orders/${orderId}?userRole=booker`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: `Đã có cơm 😍`,
            content: `Ngày ăn ${formatTimestamp(
              +subOrderDate!,
              'dd/MM',
            )} đã được giao đến bạn. Chúc ${displayName} và đồng nghiệp có một bữa ăn ngon miệng.`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    case EBookerNativeNotificationType.OrderIsPendingPayment:
      {
        const { order } = notificationParams;
        const orderListing = Listing(order!);
        const orderId = orderListing.getId();
        const { startDate, endDate } = orderListing.getMetadata();

        const url = `${BASE_URL}/company/orders/${orderId}/rating?userRole=booker`;

        oneSignalUserIds.forEach((oneSignalUserId: string) => {
          sendNotification({
            title: `Đánh giá tuần ăn 🌟`,
            content: `${displayName} ơi, bạn đánh giá tuần ăn ${formatTimestamp(
              startDate,
              'dd/MM',
            )} -${formatTimestamp(endDate, 'dd/MM')} mấy điểm?`,
            url,
            oneSignalUserId,
          });
        });
      }
      break;

    default:
      break;
  }
};
