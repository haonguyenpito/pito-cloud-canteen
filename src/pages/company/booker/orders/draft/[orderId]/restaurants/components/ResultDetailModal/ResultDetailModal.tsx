/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

import Button from '@components/Button/Button';
import IconClose from '@components/Icons/IconClose/IconClose';
import Modal from '@components/Modal/Modal';
import ResponsiveImage from '@components/ResponsiveImage/ResponsiveImage';
import SlideModal from '@components/SlideModal/SlideModal';
import { calculateDistance } from '@helpers/mapHelpers';
import { getIsAllowAddSecondaryFood } from '@helpers/orderHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { useViewport } from '@hooks/useViewport';
import { orderAsyncActions } from '@redux/slices/Order.slice';
import { Listing } from '@utils/data';
import { EImageVariants, EOrderType } from '@utils/enums';
import type { TListing } from '@utils/types';

import { BookerSelectRestaurantThunks } from '../../BookerSelectRestaurant.slice';
import { getListingImageById } from '../../helpers';
import { useGetPlanDetails } from '../../hooks/orderData';
import { useGetRestaurant } from '../../hooks/restaurants';
import FoodDetailModal from '../FoodDetailModal/FoodDetailModal';

import FoodListSection from './FoodListSection';
import ResultDetailFilters from './ResultDetailFilters';
import ResultDetailHeader from './ResultDetailHeader';
import TopContent from './TopContent';

import css from './ResultDetailModal.module.scss';

const RestaurantReviewModal = dynamic(
  () => import('../RestaurantReviewModal/RestaurantReviewModal'),
);

type TResultDetailModalProps = {
  isOpen?: boolean;
  onClose?: () => void;
  selectedRestaurantId?: string;
  restaurantFood: {
    [restaurantId: string]: TListing[];
  };
  restaurants: TListing[];
  companyGeoOrigin: {
    lat: number;
    lng: number;
  };
  fetchFoodInProgress: boolean;
  openFromCalendar?: boolean;
  timestamp?: number;
  onSearchSubmit?: (value: string, restaurantId: string) => void;
  packagePerMember?: number;
};

const ResultDetailModal: React.FC<TResultDetailModalProps> = ({
  isOpen = false,
  onClose = () => null,
  restaurantFood,
  selectedRestaurantId,
  restaurants,
  companyGeoOrigin,
  onSearchSubmit,
  fetchFoodInProgress,
  openFromCalendar,
  timestamp: propTimestamp,
  packagePerMember = 0,
}) => {
  const intl = useIntl();
  const router = useRouter();
  const { timestamp } = router.query;
  const { isTabletLayoutOrLarger } = useViewport();

  const restaurantReviewModalControl = useBoolean();
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const foodModal = useBoolean(false);
  const [selectedFood, setSelectedFood] = useState<TListing | null>(null);
  const updatePlanDetailInProgress = useAppSelector(
    (state) => state.BookerSelectRestaurant.updatePlanDetailInProgress,
  );
  const menuFoodExtraFees = useAppSelector(
    (state) => state.BookerSelectRestaurant.menuFoodExtraFees,
  );
  const currentMenuId = useAppSelector(
    (state) => state.BookerSelectRestaurant.currentMenuId,
  );
  const { restaurant: preselectedRestaurant } = useGetRestaurant();
  const { orderId, planId, planDetail, orderType } = useGetPlanDetails();
  const order = useAppSelector((state) => state.BookerSelectRestaurant.order);
  const { orderDetail } = Listing(planDetail).getMetadata();
  const initialFoodIds = useMemo(() => {
    const detail =
      orderDetail?.[`${openFromCalendar ? propTimestamp : timestamp}`];
    const savedRestaurantId = detail?.restaurant?.id;
    if (selectedRestaurantId === savedRestaurantId) {
      const foodListObj = detail?.restaurant?.foodList || {};

      return Object.keys(foodListObj) || [];
    }

    return [];
  }, [
    isOpen,
    timestamp?.toString(),
    propTimestamp?.toString(),
    JSON.stringify(orderDetail),
  ]);
  useEffect(() => {
    setSelectedFoods(initialFoodIds);
  }, [initialFoodIds]);

  const currentRestaurant = useMemo(
    () =>
      preselectedRestaurant ||
      restaurants.find(
        (restaurant) => restaurant.id?.uuid === selectedRestaurantId,
      ) ||
      null,
    [restaurants, selectedRestaurantId, JSON.stringify(preselectedRestaurant)],
  );

  const isNormalOrder = orderType === EOrderType.normal;

  const restaurantGetter = Listing(currentRestaurant!);
  const { geolocation: restaurantOrigin } = restaurantGetter.getAttributes();
  const { totalRating = 0, totalRatingNumber = 0 } =
    restaurantGetter.getMetadata();
  const restaurantName = restaurantGetter.getAttributes().title;
  const {
    avatarImageId,
    coverImageId,
    minQuantity = 0,
    maxQuantity = 100,
    phoneNumber,
  } = restaurantGetter.getPublicData();
  const restaurantAvatar = getListingImageById(
    avatarImageId,
    restaurantGetter.getImages(),
  );
  const restaurantCover = getListingImageById(
    coverImageId,
    restaurantGetter.getImages(),
  );

  const distance = useMemo(
    () =>
      restaurantOrigin
        ? calculateDistance(companyGeoOrigin, restaurantOrigin)
        : '0',
    [companyGeoOrigin, restaurantOrigin],
  );

  const originFoodIdList = useMemo(() => {
    return (restaurantFood?.[selectedRestaurantId!] || []).map(
      (item) => item?.id?.uuid,
    );
  }, [restaurantFood, selectedRestaurantId]);

  const foodList = restaurantFood?.[selectedRestaurantId!];
  // The fee is a property of the menu being browsed, not of the dish.
  const extraFeeByFoodId = menuFoodExtraFees?.[currentMenuId!] || {};

  const submitFoodListDisabled = selectedFoods.length === 0;

  // Method
  const dispatch = useAppDispatch();

  const handleSelectFood = useCallback(
    (foodId: string) => {
      setSelectedFoods([...selectedFoods, foodId]);
      if (foodModal.value) {
        foodModal.setFalse();
      }
    },
    [selectedFoods, foodModal.value],
  );

  const handleRemoveFood = useCallback(
    (foodId: string) => {
      setSelectedFoods(selectedFoods.filter((id) => id !== foodId));
    },
    [selectedFoods],
  );

  const handleSelectFoods = useCallback((foodIds: string[]) => {
    setSelectedFoods([...foodIds]);
  }, []);

  const handleOpenFoodDetail = (foodId: string) => {
    foodModal.setTrue();
    setSelectedFood(
      restaurantFood[selectedRestaurantId!].find(
        (food) => food.id?.uuid === foodId,
      ) || null,
    );
  };

  const handleConfirmFoodList = async () => {
    if (updatePlanDetailInProgress) {
      return;
    }

    const isSecondaryFoodAllowedCompany = getIsAllowAddSecondaryFood(
      order as TListing,
    );

    const updateFoodList = selectedFoods.reduce((acc: any, foodId: string) => {
      const food = foodList?.find((item) => item.id?.uuid === foodId);
      if (food) {
        const foodListingGetter = Listing(food).getAttributes();
        const originalPrice = foodListingGetter.price?.amount || 0;
        const foodName = foodListingGetter.title || '';

        const numberOfMainDishes =
          foodListingGetter.publicData?.numberOfMainDishes;
        const isSinglePickFood =
          numberOfMainDishes !== undefined &&
          numberOfMainDishes !== null &&
          Number(numberOfMainDishes) === 1;

        const isHalved = isSecondaryFoodAllowedCompany && !isSinglePickFood;
        const finalPrice = isHalved ? originalPrice / 2 : originalPrice;

        // The menu's extra fee follows the base price: when a dual-selection
        // company splits one package across two dishes, the per-meal markup
        // must stay the same rather than being charged twice.
        const originalExtraFee = extraFeeByFoodId[foodId] ?? 0;
        const finalExtraFee = isHalved
          ? originalExtraFee / 2
          : originalExtraFee;

        acc[foodId] = {
          foodName,
          foodPrice: finalPrice,
          foodExtraFee: finalExtraFee,
          foodUnit: foodListingGetter.publicData?.unit || '',
          numberOfMainDishes,
        };
      }

      return acc;
    }, {});

    const updateLineItems = isNormalOrder
      ? Object.entries<{
          foodName: string;
          foodPrice: number;
        }>(updateFoodList).map(([foodId, { foodName, foodPrice }]) => {
          return {
            id: foodId,
            name: foodName,
            unitPrice: foodPrice,
            price: foodPrice,
            quantity: 1,
          };
        })
      : [];

    const updatedValues = {
      [`${openFromCalendar ? propTimestamp : timestamp}`]: {
        restaurant: {
          ...orderDetail?.[`${openFromCalendar ? propTimestamp : timestamp}`]
            ?.restaurant,
          foodList: updateFoodList,
          id: selectedRestaurantId,
          restaurantName,
          menuId: currentMenuId,
          phoneNumber,
          minQuantity,
          maxQuantity,
        },
        lineItems: updateLineItems,
      },
    };
    await dispatch(
      BookerSelectRestaurantThunks.updatePlanDetail({
        orderId,
        planId,
        orderDetail: updatedValues,
        updateMode: 'merge',
      }),
    );

    if (!openFromCalendar) {
      onClose();
      router.push(
        `/company/booker/orders/draft/${orderId}?subOrderDate=${timestamp}`,
      );
    } else {
      await dispatch(orderAsyncActions.fetchOrderDetail([planId]));
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedFoods([]);
    }
  }, [isOpen]);

  const onCustomSearchSubmit = useCallback(
    (keyword: string) => {
      onSearchSubmit?.(keyword, selectedRestaurantId!);
    },
    [onSearchSubmit, selectedRestaurantId],
  );

  const onOpenReviewModal = useCallback(() => {
    restaurantReviewModalControl.setTrue();
  }, []);

  if (!isOpen) {
    return null;
  }

  const ModalComponent = !isTabletLayoutOrLarger ? SlideModal : Modal;

  return (
    <>
      <ModalComponent
        id="ResultDetailModal"
        scrollLayerClassName={css.scrollLayer}
        containerClassName={css.modalContainer}
        isOpen={isOpen}
        handleClose={onClose}
        onClose={onClose}
        customHeader={
          <div className={css.modalHeader}>
            <IconClose className={css.iconClose} onClick={onClose} />
          </div>
        }>
        <ResultDetailHeader
          restaurant={currentRestaurant!}
          numberSelectedDish={selectedFoods.length}
        />
        <div className={css.contentScroll}>
          <div className={css.coverImageWrapper}>
            <div className={css.coverImage}>
              <ResponsiveImage
                className={css.restaurantCover}
                alt={restaurantName}
                image={restaurantCover}
                variants={[
                  EImageVariants.default,
                  EImageVariants.landscapeCrop,
                ]}
              />
            </div>
          </div>
          <div className={css.content}>
            <div className={css.coverImage}>
              <ResponsiveImage
                className={css.restaurantCover}
                alt={restaurantName}
                image={restaurantCover}
                variants={[
                  EImageVariants.default,
                  EImageVariants.landscapeCrop,
                ]}
              />
            </div>
            <TopContent
              avatar={restaurantAvatar}
              restaurantName={restaurantName}
              rating={`${totalRating} (${totalRatingNumber} ${intl.formatMessage(
                { id: 'danh-gia-0' },
              )})`}
              ratingNumber={totalRating}
              distance={`${distance}km`}
              onOpenReviewModal={onOpenReviewModal}
              minQuantity={minQuantity}
              hideInforInMobile={!isTabletLayoutOrLarger}
            />
            <ResultDetailFilters
              onSelectAllFood={handleSelectFoods}
              selectedFoodIds={selectedFoods}
              originFoodIdList={originFoodIdList}
              onSearchSubmit={onCustomSearchSubmit}
            />
            <FoodListSection
              foodList={foodList}
              onSelectFood={handleSelectFood}
              onRemoveFood={handleRemoveFood}
              onClickFood={handleOpenFoodDetail}
              selectedFoodIds={selectedFoods}
              fetchFoodInProgress={fetchFoodInProgress}
              packagePerMember={packagePerMember}
              extraFeeByFoodId={extraFeeByFoodId}
            />
          </div>
        </div>
        <div className={css.footer}>
          <Button
            className={css.submitBtn}
            onClick={handleConfirmFoodList}
            disabled={submitFoodListDisabled}
            loadingMode="extend"
            inProgress={updatePlanDetailInProgress}>
            <span>
              {intl.formatMessage(
                {
                  id: 'booker.orders.draft.resultDetailModal.addRestaurant',
                },
                {
                  numberDish: selectedFoods.length,
                },
              )}
            </span>
          </Button>
        </div>
      </ModalComponent>
      <FoodDetailModal
        isOpen={foodModal.value}
        food={selectedFood!}
        onClose={foodModal.setFalse}
        onSelect={handleSelectFood}
        isMobileLayout={!isTabletLayoutOrLarger}
        extraFee={extraFeeByFoodId[`${selectedFood?.id?.uuid}`] ?? 0}
      />
      {restaurantReviewModalControl.value && (
        <RestaurantReviewModal
          isOpen={restaurantReviewModalControl.value}
          onClose={restaurantReviewModalControl.setFalse}
        />
      )}
    </>
  );
};

export default ResultDetailModal;
