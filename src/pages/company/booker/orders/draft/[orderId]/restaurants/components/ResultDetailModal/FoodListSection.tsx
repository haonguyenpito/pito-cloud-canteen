import React from 'react';
import { useIntl } from 'react-intl';
import classNames from 'classnames';

import FoodCard from '@components/FoodCard/FoodCard';
import IconSpinner from '@components/Icons/IconSpinner/IconSpinner';
import { getFoodBillablePrice } from '@helpers/menuExtraFee';
import type { FoodListing } from '@src/types';
import type { TListing } from '@utils/types';

import css from './ResultDetailModal.module.scss';

type TFoodsListSectionProps = {
  onClickFood?: (foodId: string) => void;
  onSelectFood?: (foodId: string) => void;
  onRemoveFood?: (foodId: string) => void;
  selectedFoodIds?: string[];
  foodList?: TListing[];
  hideSelection?: boolean;
  fetchFoodInProgress?: boolean;
  packagePerMember?: number;
  extraFeeByFoodId?: Record<string, number>;
};

/**
 * Lists a menu's dishes for the booker, split into dishes priced exactly at the
 * package and the rest. Prices are client prices (base + the menu's fee).
 * @param props.extraFeeByFoodId - The extra fees of the menu being browsed.
 * @param props.packagePerMember - The fee-inclusive budget per participant.
 */
const FoodListSection: React.FC<TFoodsListSectionProps> = ({
  onClickFood = () => null,
  onSelectFood = () => null,
  onRemoveFood = () => null,
  selectedFoodIds = [],
  foodList = [],
  hideSelection = false,
  fetchFoodInProgress = false,
  packagePerMember = 0,
  extraFeeByFoodId = {},
}) => {
  const intl = useIntl();
  const priceOf = (food: TListing) =>
    getFoodBillablePrice(food as FoodListing, extraFeeByFoodId);
  const byPriceDesc = (a: TListing, b: TListing) => priceOf(b) - priceOf(a);

  const sortesFoodList = foodList
    .filter((food) => priceOf(food) === packagePerMember)
    .sort(byPriceDesc);
  const sortesGreaterFoodList = foodList
    .filter((food) => priceOf(food) !== packagePerMember)
    .sort(byPriceDesc);
  const extraFeeOf = (food: TListing) => extraFeeByFoodId[food?.id?.uuid] ?? 0;

  return (
    <section className={classNames(css.foodSection)}>
      <div className={css.categories}>
        <div className={css.category}>
          {fetchFoodInProgress ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : (
            <div className={classNames(css.foodList, '!gap-2')}>
              {!!sortesFoodList.length && (
                <h3
                  className={classNames(
                    css.categoryTitle,
                    '!text-base font-semibold w-full !m-0',
                  )}>
                  {intl.formatMessage({
                    id: 'mon-an-nam-trong-muc-gia-da-chon',
                  })}
                </h3>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {sortesFoodList.map((item) => (
                  <FoodCard
                    food={item}
                    key={item?.id.uuid}
                    isSelected={selectedFoodIds?.includes(`${item?.id.uuid}`)}
                    onSelect={onSelectFood}
                    onRemove={onRemoveFood}
                    onClick={onClickFood}
                    className={classNames(
                      css.foodItem,
                      '!w-full !max-w-[unset]',
                    )}
                    hideSelection={hideSelection}
                    extraFee={extraFeeOf(item)}
                  />
                ))}
              </div>

              {!foodList.length && (
                <div className={css.emptyFoodList}>
                  {intl.formatMessage({
                    id: 'SelectRestaurantPage.EmptyFood',
                  })}
                </div>
              )}

              {sortesGreaterFoodList.length > 0 && (
                <div className={classNames(css.categories, 'w-full')}>
                  <div className={css.category}>
                    {!!sortesGreaterFoodList.length && (
                      <h3
                        className={classNames(
                          css.categoryTitle,
                          '!text-base font-semibold w-full !my-2 !mt-4',
                        )}>
                        {intl.formatMessage({
                          id: 'mon-an-nam-ngoai-muc-gia-da-chon',
                        })}
                      </h3>
                    )}

                    {fetchFoodInProgress ? (
                      <div className={css.loading}>
                        <IconSpinner />
                      </div>
                    ) : (
                      <div className={classNames(css.foodList, 'w-full')}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                          {sortesGreaterFoodList.map((item) => (
                            <FoodCard
                              key={`${item?.id.uuid}`}
                              food={item}
                              isSelected={selectedFoodIds?.includes(
                                `${item?.id.uuid}`,
                              )}
                              onSelect={onSelectFood}
                              onRemove={onRemoveFood}
                              onClick={onClickFood}
                              className={classNames(
                                css.foodItem,
                                '!w-full !max-w-[unset]',
                              )}
                              hideSelection={hideSelection}
                              extraFee={extraFeeOf(item)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default FoodListSection;
