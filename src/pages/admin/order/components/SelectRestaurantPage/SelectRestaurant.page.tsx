/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import { DateTime } from 'luxon';

import Badge from '@components/Badge/Badge';
import IconArrowHead from '@components/Icons/IconArrowHead/IconArrowHead';
import Pagination from '@components/Pagination/Pagination';
import {
  getSelectedRestaurantAndFoodList,
  getUpdateLineItems,
} from '@helpers/orderHelper';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { selectRestaurantPageThunks } from '@redux/slices/SelectRestaurantPage.slice';
import { Listing } from '@utils/data';
import type { TListing, TObject } from '@utils/types';

import type { TSelectFoodFormValues } from '../SelectFoodModal/components/SelectFoodForm/SelectFoodForm';
import SelectFoodModal from '../SelectFoodModal/SelectFoodModal';

import RestaurantTable from './components/RestaurantTable/RestaurantTable';
import SearchRestaurantForm from './components/SearchRestaurantForm/SearchRestaurantForm';

import css from './SelectRestaurantPage.module.scss';

const DEBOUNCE_TIME = 500;

type TSelectRestaurantPageProps = {
  onSubmitRestaurant: (values: TObject) => void;
  selectedDate: Date;
  onBack: () => void;
  selectFoodInProgress: boolean;
};

const SelectRestaurantPage: React.FC<TSelectRestaurantPageProps> = ({
  onSubmitRestaurant,
  selectedDate,
  onBack,
  selectFoodInProgress,
}) => {
  const [currentRestaurant, setCurrentRestaurant] = useState<any>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [titleValue, setTitleValue] = useState('');
  const intl = useIntl();
  const { value: isModalOpen, setValue: setModalOpen } = useBoolean();
  const dispatch = useAppDispatch();
  const restaurants = useAppSelector(
    (state) => state.SelectRestaurantPage.restaurants,
    shallowEqual,
  );

  const pagination = useAppSelector(
    (state) => state.SelectRestaurantPage.pagination,
    shallowEqual,
  );
  const foodList = useAppSelector(
    (state) => state.SelectRestaurantPage.foodList,
    shallowEqual,
  );
  const foodExtraFees = useAppSelector(
    (state) => state.SelectRestaurantPage.foodExtraFees,
    shallowEqual,
  );
  const fetchFoodPending = useAppSelector(
    (state) => state.SelectRestaurantPage.fetchFoodPending,
  );
  const fetchRestaurantsPending = useAppSelector(
    (state) => state.SelectRestaurantPage.fetchRestaurantsPending,
  );
  const order = useAppSelector((state) => state.Order.order, shallowEqual);
  const selectedTime = selectedDate.getTime();
  const {
    deliveryHour,
    deliveryAddress,
    packagePerMember,
    nutritions = [],
  } = Listing(order as TListing).getMetadata();
  const shouldShowRestaurantPagination =
    !!restaurants && restaurants?.length > 0 && !fetchRestaurantsPending;
  const { totalItems: total, page: pageFromRedux } = pagination || {};
  const paginationProps = {
    total,
    current: pageFromRedux && page !== pageFromRedux ? pageFromRedux : page,
    pageSize: perPage,
  };
  const showModalCondition = isModalOpen && !fetchFoodPending;

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  let currDebounceRef = debounceRef.current;

  const dateTime = DateTime.fromJSDate(selectedDate);
  const formattedDate = dateTime.toFormat('dd/MM/yyyy - EEE', { locale: 'vi' });
  const labelForBadge = intl.formatMessage(
    { id: 'SelectRestaurantPage.subtitle' },
    {
      date: formattedDate,
      hour: deliveryHour,
      address: deliveryAddress?.address,
    },
  );

  useEffect(() => {
    dispatch(
      selectRestaurantPageThunks.getRestaurants({
        dateTime: dateTime.toMillis(),
        packagePerMember,
        title: titleValue,
        deliveryHour,
        nutritions,
        page,
        perPage,
      }),
    );
  }, [
    packagePerMember,
    deliveryHour,
    JSON.stringify(nutritions),
    dispatch,
    page,
    perPage,
    titleValue,
  ]);

  const handlePageChange = (pageValue: number) => {
    setPage(pageValue);
  };

  const handlePerPageChange = (pageValue: number, perPageValue: number) => {
    setPerPage(perPageValue);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCurrentRestaurant(undefined);
  };

  const handleSearchRestaurant = (title: string) => {
    if (currDebounceRef) {
      clearTimeout(currDebounceRef);
    }

    currDebounceRef = setTimeout(() => {
      setTitleValue(title);
    }, DEBOUNCE_TIME);
  };

  const handleSelectFood = async (values: TSelectFoodFormValues) => {
    const { food: foodIds } = values;

    const currRestaurantId = currentRestaurant?.id?.uuid;

    const { submitRestaurantData, submitFoodListData } =
      getSelectedRestaurantAndFoodList({
        foodList,
        foodIds,
        currentRestaurant,
        extraFeeByFoodId: foodExtraFees,
      });

    const updateLineItems = getUpdateLineItems(
      foodList,
      foodIds,
      foodExtraFees,
    );

    await onSubmitRestaurant({
      restaurant: {
        ...submitRestaurantData,
        menuId: restaurants?.find(
          (restaurant) =>
            restaurant.restaurantInfo.id.uuid === currRestaurantId,
        ).menu.id.uuid,
      },
      selectedFoodList: submitFoodListData,
      lineItems: updateLineItems,
    });
    setModalOpen(false);
  };

  const handleRestaurantClick = (restaurant: any) => () => {
    const { restaurantInfo, menu } = restaurant;
    const {
      stopReceiveOrder = false,
      startStopReceiveOrderDate = 0,
      endStopReceiveOrderDate = 0,
    } = Listing(restaurantInfo).getPublicData();
    const disabledSelectRestaurant =
      stopReceiveOrder &&
      selectedTime >= startStopReceiveOrderDate &&
      selectedTime <= endStopReceiveOrderDate;

    if (disabledSelectRestaurant) {
      return;
    }

    dispatch(
      selectRestaurantPageThunks.getRestaurantFood({
        subOrderDate: dateTime.toMillis(),
        menuId: Listing(menu).getId(),
      }),
    );
    setCurrentRestaurant(restaurantInfo);
    setModalOpen(true);
  };

  return (
    <section className={css.root}>
      <div className={css.goBackContainer} onClick={onBack}>
        <IconArrowHead direction="left" />
        <span className={css.goBack}></span>
        <FormattedMessage id="SelectRestaurantPage.goBack" />
      </div>
      <div className={css.titleContainer}>
        <h1>
          <FormattedMessage id="SelectRestaurantPage.title" />
        </h1>
        <Badge label={labelForBadge} />
      </div>
      <SearchRestaurantForm
        onSubmit={() => {}}
        onSearchRestaurant={handleSearchRestaurant}
      />
      <RestaurantTable
        selectedTime={selectedTime}
        restaurants={restaurants}
        onItemClick={handleRestaurantClick}
      />
      {shouldShowRestaurantPagination && (
        <div className={css.paginationContainer}>
          <Pagination
            showSizeChanger
            {...paginationProps}
            onChange={handlePageChange}
            onShowSizeChange={handlePerPageChange}
          />
        </div>
      )}
      <SelectFoodModal
        restaurant={currentRestaurant}
        items={foodList}
        isOpen={showModalCondition}
        handleClose={handleCloseModal}
        handleSelectFood={handleSelectFood}
        selectFoodInProgress={selectFoodInProgress}
      />
    </section>
  );
};

export default SelectRestaurantPage;
