import React, { useEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';
import { useRouter } from 'next/router';

import RestaurantCard from '@components/RestaurantCard/RestaurantCard';
import type { TGeoOrigin } from '@helpers/listingSearchQuery';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import type { TFoodInRestaurant } from '@src/types/bookerSelectRestaurant';
import { Listing } from '@utils/data';
import type { TListing } from '@utils/types';

import {
  BookerSelectRestaurantActions,
  BookerSelectRestaurantThunks,
} from '../../BookerSelectRestaurant.slice';
import ResultDetailModal from '../ResultDetailModal/ResultDetailModal';

import EmptyList from './EmptyList';

import css from './ResultList.module.scss';

type TResultListProps = {
  className?: string;
  restaurants?: any[];
  groupRestaurantInFoods?: Map<string, TFoodInRestaurant[]> | null;
  isLoading?: boolean;
  companyGeoOrigin: TGeoOrigin;
  order?: TListing | null;
};

const ResultList: React.FC<TResultListProps> = ({
  className,
  restaurants = [],
  isLoading,
  companyGeoOrigin,
  order,
  groupRestaurantInFoods,
}) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { timestamp: queryTs, restaurantId, orderId, menuId } = router.query;
  const timestamp = +`${queryTs}`;

  const { packagePerMember = 0 } = Listing(order!).getMetadata();

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<
    string | undefined
  >(`${restaurantId}`);
  const detailModal = useBoolean(!!restaurantId);
  const restaurantFood = useAppSelector(
    (state) => state.BookerSelectRestaurant.restaurantFood,
    shallowEqual,
  );
  const fetchRestaurantFoodInProgress = useAppSelector(
    (state) => state.BookerSelectRestaurant.fetchRestaurantFoodInProgress,
  );

  const onRestaurantClick = (id: string) => {
    detailModal.setTrue();
    setSelectedRestaurantId(id);
    dispatch(BookerSelectRestaurantActions.setSelectedRestaurantId(id));
    dispatch(
      BookerSelectRestaurantThunks.fetchFoodListFromRestaurant({
        restaurantId: id,
        timestamp,
      }),
    );
  };

  useEffect(() => {
    if (detailModal.value && restaurantId && order) {
      dispatch(
        BookerSelectRestaurantThunks.fetchFoodListFromRestaurant({
          restaurantId: `${restaurantId}`,
          menuId: `${menuId}`,
          timestamp,
        }),
      );
    }
  }, [restaurantId, menuId, detailModal.value, JSON.stringify(order)]);

  const handleCloseDetail = () => {
    if (restaurantId) {
      router.push({
        pathname: router.pathname,
        query: { orderId, timestamp },
      });
    } else {
      detailModal.setFalse();
    }
  };

  const onSearchSubmit = (_keywords: string, _restaurantId: string) => {
    if (!selectedRestaurantId) return;

    dispatch(
      BookerSelectRestaurantThunks.fetchFoodListFromRestaurant({
        restaurantId: selectedRestaurantId,
        menuId: typeof menuId === 'string' ? menuId : undefined,
        timestamp,
      }),
    );
  };

  const classes = classNames(css.root, className);

  return (
    <>
      <div className={classes}>
        {isLoading && (
          <div className={css.loadingList}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((item) => (
              <Skeleton key={item} className={css.loadingCard} />
            ))}
          </div>
        )}
        {!isLoading && !restaurants.length && <EmptyList />}
        {!isLoading &&
          restaurants.map((restaurant) => {
            const foods = groupRestaurantInFoods?.get(restaurant?.id.uuid);

            return (
              <RestaurantCard
                onClick={onRestaurantClick}
                key={restaurant?.id.uuid}
                className={css.card}
                restaurant={restaurant}
                foods={foods ?? []}
                packagePerMember={packagePerMember}
              />
            );
          })}
      </div>
      <ResultDetailModal
        isOpen={detailModal.value}
        onClose={handleCloseDetail}
        restaurantFood={restaurantFood}
        selectedRestaurantId={selectedRestaurantId}
        restaurants={restaurants}
        companyGeoOrigin={companyGeoOrigin}
        onSearchSubmit={onSearchSubmit}
        fetchFoodInProgress={fetchRestaurantFoodInProgress}
        packagePerMember={packagePerMember}
      />
    </>
  );
};

export default ResultList;
