import React, { useMemo } from 'react';
import { FormattedMessage } from 'react-intl';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import CalendarDashboard from '@components/CalendarDashboard/CalendarDashboard';
import { getBillablePrice } from '@helpers/menuExtraFee';
import { renderResourcesForCalendar } from '@pages/admin/partner/[restaurantId]/settings/menu/components/EditPartnerMenuWizard/utils';
import FoodEventCard from '@pages/admin/partner/[restaurantId]/settings/menu/components/FoodEventCard/FoodEventCard';
import type { MenuListing } from '@src/types';
import { getLabelByKey, MENU_TYPE_OPTIONS } from '@src/utils/options';
import {
  addDaysToDate,
  formatTimestamp,
  getDayOfWeekAsIndex,
  getStartOfWeek,
} from '@utils/dates';
import type { EDayOfWeek } from '@utils/enums';
import { EMenuMealType } from '@utils/enums';

type TMenuApprovalDetailProps = {
  menu: MenuListing & { restaurantName: string };
  anchorDate: Date;
  extraFeeByFoodId?: Record<string, number>;
};

const getMealTypeLabel = (mealType: string) => {
  const labels: Record<string, string> = {
    [EMenuMealType.breakfast]: 'Ăn sáng',
    [EMenuMealType.lunch]: 'Ăn trưa',
    [EMenuMealType.dinner]: 'Ăn tối',
    [EMenuMealType.snack]: 'Ăn xế',
  };

  return labels[mealType] || mealType;
};

const getDayOfWeekShortLabel = (day: string) => {
  const labels: Record<string, string> = {
    mon: 'T2',
    tue: 'T3',
    wed: 'T4',
    thu: 'T5',
    fri: 'T6',
    sat: 'T7',
    sun: 'CN',
  };

  return labels[day] || day;
};

const getDayOfWeekLabel = (day: string) => {
  const labels: Record<string, string> = {
    mon: 'Thứ 2',
    tue: 'Thứ 3',
    wed: 'Thứ 4',
    thu: 'Thứ 5',
    fri: 'Thứ 6',
    sat: 'Thứ 7',
    sun: 'Chủ nhật',
  };

  return labels[day] || day;
};

const convertFoodsByDateToTimestampFormat = (
  foodsByDate: Record<string, Record<string, any>> | undefined,
  anchorDate: Date,
): Record<string, Record<string, any>> => {
  if (!foodsByDate) {
    return {};
  }

  const converted: Record<string, Record<string, any>> = {};
  const startDayOfWeek = getStartOfWeek(anchorDate.getTime());

  Object.keys(foodsByDate).forEach((dayOfWeek) => {
    if (
      dayOfWeek &&
      (dayOfWeek === 'mon' ||
        dayOfWeek === 'tue' ||
        dayOfWeek === 'wed' ||
        dayOfWeek === 'thu' ||
        dayOfWeek === 'fri' ||
        dayOfWeek === 'sat' ||
        dayOfWeek === 'sun')
    ) {
      const dayOfWeekAsNumber = getDayOfWeekAsIndex(dayOfWeek as EDayOfWeek);
      const dateOfDay = addDaysToDate(startDayOfWeek, dayOfWeekAsNumber);
      const timestampKey = dateOfDay.getTime().toString();
      converted[timestampKey] = foodsByDate[dayOfWeek];
    }
  });

  return converted;
};

const CalendarContentStartReadOnly = (): JSX.Element => <></>;

const CalendarContentEndReadOnly = (): JSX.Element => <></>;

/**
 * Read-only review of a partner menu: its information, schedule and dishes.
 * Each dish card shows the partner price and the client price (with the fee).
 * @param props.menu - The menu under review.
 * @param props.anchorDate - Week the calendar opens on.
 * @param props.extraFeeByFoodId - The menu's extra fees.
 */
const MenuApprovalDetail = ({
  menu,
  anchorDate,
  extraFeeByFoodId = {},
}: TMenuApprovalDetailProps) => {
  const attributes = menu?.attributes;
  const publicData = attributes?.publicData;
  const metadata = attributes?.metadata;
  const title = attributes?.title || '';
  const menuType = publicData?.menuType || metadata?.menuType || '';
  const mealType = publicData?.mealType || '';
  const startDate = publicData?.startDate;
  const endDate = publicData?.endDate;
  const foodsByDate = publicData?.foodsByDate;

  const daysOfWeekArray = useMemo(() => {
    return (publicData?.daysOfWeek || []) as string[];
  }, [publicData?.daysOfWeek]);

  const resourcesForCalendar = useMemo(() => {
    if (!foodsByDate) {
      return [];
    }

    const convertedFoodsByDate = convertFoodsByDateToTimestampFormat(
      foodsByDate,
      anchorDate,
    );

    return renderResourcesForCalendar(convertedFoodsByDate, {
      onRemovePickedFood: () => {},
      daysOfWeek: daysOfWeekArray,
      hideRemoveButton: true,
      showPrice: true,
      extraFeeByFoodId,
    }).sort(
      (a, b) =>
        getBillablePrice(a.resource.price, a.resource.extraFee) -
        getBillablePrice(b.resource.price, b.resource.extraFee),
    );
  }, [foodsByDate, daysOfWeekArray, anchorDate, extraFeeByFoodId]);

  return (
    <div>
      {/* Menu Information Section - matching EditMenuCompleteForm */}
      <div className="py-8 border-b border-gray-200">
        <h3 className="text-lg font-medium capitalize mb-4">
          <FormattedMessage id="EditMenuCompleteForm.menuInformation" />
        </h3>
        <div className="flex flex-wrap gap-y-4">
          <div className="w-[300px] mr-[60px]">
            <label className="text-sm text-gray-500 block">
              <FormattedMessage id="EditMenuCompleteForm.menuName" />
            </label>
            <div className="text-base text-gray-700">{title}</div>
          </div>
          <div className="w-[300px] mr-[60px]">
            <label className="text-sm text-gray-500 block">
              <FormattedMessage id="MenuApprovalDetail.partner" />
            </label>
            <div className="text-base text-gray-700">{menu.restaurantName}</div>
          </div>
          <div className="w-[300px] mr-[60px]">
            <label className="text-sm text-gray-500 block">
              <FormattedMessage id="EditMenuCompleteForm.menuType" />
            </label>
            <div className="text-base text-gray-700">
              {getLabelByKey(MENU_TYPE_OPTIONS, menuType)}
            </div>
          </div>
          <div className="w-[300px] mr-[60px]">
            <label className="text-sm text-gray-500 block mb-1">
              <FormattedMessage id="MenuApprovalDetail.mealType" />
            </label>
            <Badge label={getMealTypeLabel(mealType)} type={EBadgeType.info} />
          </div>
        </div>
      </div>

      {/* Apply Time Section - matching EditMenuCompleteForm */}
      <div className="py-8 border-b border-gray-200">
        <h3 className="text-lg font-medium capitalize mb-4">
          <FormattedMessage id="EditMenuCompleteForm.applyTime" />
        </h3>
        <div className="flex flex-wrap gap-y-4">
          <div className="w-[300px] mr-[60px]">
            <label className="text-sm text-gray-500 block">
              <FormattedMessage id="EditMenuCompleteForm.startDate" />
            </label>
            <div className="text-base text-gray-700">
              {startDate && formatTimestamp(startDate, 'EEE, dd MMMM, yyyy')}
            </div>
          </div>
          <div className="w-[300px] mr-[60px]">
            <label className="text-sm text-gray-500 block">
              <FormattedMessage id="EditMenuCompleteForm.endDateLabel" />
            </label>
            <div className="text-base text-gray-700">
              {endDate && formatTimestamp(endDate, 'EEE, dd MMMM, yyyy')}
            </div>
          </div>
        </div>

        {/* Days of Week */}
        <div className="mt-4">
          <label className="text-sm text-gray-500 block mb-2">
            <FormattedMessage id="MenuApprovalDetail.daysOfWeek" />
          </label>
          <div className="flex flex-wrap gap-2">
            {daysOfWeekArray.map((day) => (
              <div
                key={day}
                className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium"
                title={getDayOfWeekLabel(day)}>
                {getDayOfWeekShortLabel(day)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="py-8 border-b border-gray-200">
        <h3 className="text-lg font-medium capitalize mb-4">
          <FormattedMessage id="EditMenuCompleteForm.foodList" />
        </h3>
        <CalendarDashboard
          anchorDate={anchorDate}
          renderEvent={FoodEventCard}
          events={resourcesForCalendar}
          components={{
            toolbar: () => null,
            contentEnd: CalendarContentEndReadOnly,
            contentStart: CalendarContentStartReadOnly,
          }}
        />
      </div>
    </div>
  );
};

export default MenuApprovalDetail;
