/* eslint-disable @typescript-eslint/no-shadow */
import flatten from 'lodash/flatten';
import uniq from 'lodash/uniq';
import * as XLSX from 'xlsx';

import { parseThousandNumber } from '@helpers/format';
import { getTrackingLink } from '@helpers/order/prepareDataHelper';
import { formatTimestamp } from '@src/utils/dates';
import { getLabelByKey, ORDER_STATE_OPTIONS } from '@src/utils/options';
import type { TObject } from '@src/utils/types';

export const parseEntitiesToExportCsv = (
  orders: TObject[],
  exportColumns: string[],
) => {
  if (orders.length === 0 || exportColumns.length === 0) return [];
  const hasTitleCol = exportColumns.includes('title');
  const hasOrderCreatedAtCol = exportColumns.includes('orderCreatedAt');
  const hasCompanyNameCol = exportColumns.includes('companyName');
  const hasBookerPhoneNumberCol = exportColumns.includes('bookerPhoneNumber');
  const hasCompanyAddressCol = exportColumns.includes('address');
  const hasDeliveryDate = exportColumns.includes('deliveryDate');
  const hasTotalDishes = exportColumns.includes('totalDishes');
  const hasOrderNotes = exportColumns.includes('orderNotes');
  const hasPartners = exportColumns.includes('restaurants');
  const hasSubOrders = exportColumns.includes('normal');
  const hasParentOrder = exportColumns.includes('group');
  const hasPartnersPhoneNumbers = exportColumns.includes('partnerPhoneNumber');
  const hasPartnersAddress = exportColumns.includes('partnerAddress');
  const hastOrderState = exportColumns.includes('orderState');
  const hasFoodList = exportColumns.includes('foodList');
  const hasNumberPerFood = exportColumns.includes('numberPerFood');
  const hasPrice = exportColumns.includes('price');
  const hasPccFee = exportColumns.includes('pccFee');
  const hasBookerName = exportColumns.includes('bookerName');
  const hasBillingOfLading = exportColumns.includes('billingOfLading');

  const orderToExport = orders.map((order) => {
    const {
      title,
      orderCreatedAt,
      companyName,
      bookerPhoneNumber,
      companyLocation,
      // totalDishes,
      startDate,
      endDate,
      children = [],
      restaurants = [],
      fullRestaurantsData,
      orderNotes = {},
      orderNote,
      partnerLocation,
      deliveryHour,
      state,
      foodList,
      price,
      pccFee = 0,
      bookerName,
      id,
      totalParticipantOrdered = 0,
    } = order.data || {};

    console.log('order.data', order.data);

    const parentOrderData = {
      ...(hasTitleCol && { 'Mã đơn': title }),
      ...(hasOrderCreatedAtCol && {
        'Ngày tạo đơn': orderCreatedAt,
      }),
      ...(hastOrderState && {
        'Trạng thái đơn': getLabelByKey(ORDER_STATE_OPTIONS, state),
      }),
      ...(hasCompanyNameCol && { 'Tên công ty': companyName }),
      ...(hasBookerName && { 'Người đại diện': bookerName }),
      ...(hasBookerPhoneNumberCol && {
        'SĐT người đại diện': bookerPhoneNumber,
      }),
      ...(hasCompanyAddressCol && { 'Địa chỉ công ty': companyLocation }),
      ...(hasDeliveryDate && {
        'Giờ giao hàng': deliveryHour,
        'Ngày giao hàng': `${startDate}-${endDate}`,
      }),
      ...(hasTotalDishes && { 'Số phần ăn': totalParticipantOrdered }),
      ...(hasFoodList && {
        'Danh sách món': foodList.map((item: any) => item?.foodName).join('\n'),
      }),
      ...(hasNumberPerFood && {
        'Số lượng từng món': foodList
          .map((item: any) => item?.frequency)
          .join('\n'),
      }),
      ...(hasPccFee && {
        'Phí dịch vụ': parseThousandNumber(pccFee),
      }),
      ...(hasPrice && {
        'Thành tiền ': parseThousandNumber(price),
      }),
      ...(hasOrderNotes && {
        'Ghi chú đơn hàng': orderNote,
      }),
      ...(hasPartners && {
        'Đối tác': restaurants.join('\n'),
      }),
      ...(hasPartnersPhoneNumbers && {
        'SĐT đối tác': uniq(
          fullRestaurantsData.map((item: any) => item?.phoneNumber || ''),
        ).join('\n'),
      }),
      ...(hasPartnersAddress && {
        'Địa chỉ đối tác': partnerLocation.join('\n'),
      }),
    };
    const subOrdersData = hasSubOrders
      ? children.map((child: any) => {
          const {
            price,
            pccFee: childPccFee = 0,
            title,
            // totalDishes,
            foodList = [],
            partnerPhoneNumber,
            partnerLocation,
            restaurants = [],
            restaurantId,
            subOrderDate,
            timestamp,
            totalParticipantOrdered,
          } = child?.data || {};

          return {
            ...(hasTitleCol && { 'Mã đơn': title }),
            ...(hasOrderCreatedAtCol && {
              'Ngày tạo đơn': orderCreatedAt,
            }),
            ...(hastOrderState && {
              'Trạng thái đơn': getLabelByKey(ORDER_STATE_OPTIONS, state),
            }),
            ...(hasCompanyNameCol && { 'Tên công ty': companyName }),
            ...(hasBookerName && { 'Người đại diện': bookerName }),
            ...(hasBookerPhoneNumberCol && {
              'SĐT người đại diện': bookerPhoneNumber,
            }),
            ...(hasCompanyAddressCol && { 'Địa chỉ công ty': companyLocation }),
            ...(hasDeliveryDate && {
              'Giờ giao hàng': deliveryHour,
              'Ngày giao hàng': subOrderDate,
            }),
            ...(hasTotalDishes && { 'Số phần ăn': totalParticipantOrdered }),
            ...(hasFoodList && {
              'Danh sách món': foodList
                .map((item: any) => item?.foodName)
                .join('\n'),
            }),
            ...(hasNumberPerFood && {
              'Số lượng từng món': foodList
                .map((item: any) => item.frequency)
                .join('\n'),
            }),
            ...(hasPccFee && {
              'Phí dịch vụ': parseThousandNumber(childPccFee),
            }),
            ...(hasPrice && {
              'Thành tiền ': parseThousandNumber(price),
            }),
            ...(hasOrderNotes && {
              'Ghi chú đơn hàng': orderNotes[restaurantId],
            }),
            ...(hasPartners && {
              'Đối tác': restaurants.join('\n'),
            }),
            ...(hasPartnersPhoneNumbers && {
              'SĐT đối tác': partnerPhoneNumber,
            }),
            ...(hasPartnersAddress && {
              'Địa chỉ đối tác': partnerLocation,
            }),
            ...(hasBillingOfLading && {
              'Phiếu vận đơn': getTrackingLink(id, timestamp),
            }),
          };
        })
      : [];

    if (!hasTitleCol || (hasTitleCol && !hasSubOrders && !hasParentOrder)) {
      return parentOrderData;
    }

    let exportedFinalItems: any = [];
    if (hasParentOrder) {
      exportedFinalItems = [parentOrderData];
    }
    if (hasSubOrders) {
      exportedFinalItems = [...exportedFinalItems, ...subOrdersData];
    }

    return exportedFinalItems;
  });

  return flatten(orderToExport);
};

export const makeExcelFile = (data: any, exportColumns: string[]) => {
  const foodsToExport = parseEntitiesToExportCsv(data, exportColumns);
  const ws = XLSX.utils.json_to_sheet(foodsToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(
    wb,
    `${formatTimestamp(new Date().getTime())}_Danh_sách_đơn_hàng.xlsx`,
  );
};
