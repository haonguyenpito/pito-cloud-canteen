import { FiCheck, FiPlus } from 'react-icons/fi';
import classNames from 'classnames';

import Badge, { EBadgeType } from '@components/Badge/Badge';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import ResponsiveImage from '@components/ResponsiveImage/ResponsiveImage';
import { useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { useDualFoodSelection } from '@hooks/useDualFoodSelection';
import { useSingleFoodSelection } from '@hooks/useSingleFoodSelection';
import { EImageVariants } from '@src/utils/enums';
import { getLabelByKey, useFoodTypeOptionsByLocale } from '@src/utils/options';
import { getDecorator } from '@src/utils/string';
import { Listing } from '@utils/data';

import ListingDetailModal from './ListingDetailModal';

import css from './ListingCard.module.scss';

type TListCardProps = {
  className?: string;
  listing: any;
  planId: string;
  dayId: string;
  isSelected?: boolean;
  selectDisabled?: boolean;
  isOrderAlreadyStarted: boolean;
  onAddedToCart?: ({
    foodName,
    timestamp,
  }: {
    foodName?: string;
    timestamp: string;
  }) => void;
};

const ListingCard: React.FC<TListCardProps> = ({
  className,
  listing,
  planId,
  dayId,
  isSelected,
  selectDisabled,
  isOrderAlreadyStarted,
  onAddedToCart,
}) => {
  const detailModalController = useBoolean();
  const isAllowAddSecondaryFood = useAppSelector(
    (state) => state.ParticipantPlanPage.isAllowAddSecondaryFood,
  );

  const plan = useAppSelector((state) => state.ParticipantPlanPage.plan);
  const planData = plan?.[dayId];
  const foodList = planData?.foodList || [];

  const mealId = listing?.id?.uuid;
  const { title, description } = Listing(listing).getAttributes();
  const {
    allergicIngredients = [],
    foodType,
    numberOfMainDishes,
  } = Listing(listing).getPublicData();

  const listingImages = Listing(listing).getImages() || [];

  const FOOD_TYPE_OPTIONS = useFoodTypeOptionsByLocale();

  const singleFoodSelection = useSingleFoodSelection({
    mealId,
    planId,
    dayId,
    isSelected,
    selectDisabled,
    isOrderAlreadyStarted,
    mealTitle: title,
    onAddedToCart,
  });

  const dualFoodSelection = useDualFoodSelection({
    mealId,
    mealTitle: title,
    planId,
    dayId,
    isSelected,
    selectDisabled,
    isOrderAlreadyStarted,
    foodList,
    onAddedToCart,
  });

  const selection = isAllowAddSecondaryFood
    ? dualFoodSelection
    : singleFoodSelection;

  const viewListingDetail = () => {
    detailModalController.setTrue();
  };

  const handleCloseListingDetailModal = () => {
    detailModalController.setFalse();
  };

  const handleSelectFoodInModal = () => {
    if (
      isAllowAddSecondaryFood &&
      dualFoodSelection.isRestrictedForThisListing
    ) {
      detailModalController.setFalse();

      return;
    }

    selection.handleAddToCart();

    if (isAllowAddSecondaryFood) {
      detailModalController.setFalse();
    }
  };

  return (
    <div className={classNames(css.root, className)}>
      <div className={css.cardWrapper}>
        <div className={css.listingImage} onClick={viewListingDetail}>
          {listingImages.length > 0 ? (
            <ResponsiveImage
              image={listingImages[0]}
              alt={title}
              variants={[
                EImageVariants.landscapeCrop6x,
                EImageVariants.landscapeCrop4x,
              ]}
            />
          ) : (
            <div className={css.decoratorWrapper}>
              <img
                src={getDecorator(mealId)}
                alt=""
                className={css.decoratorImage}
              />
            </div>
          )}
        </div>
        <div
          className={classNames(
            css.listingCardContent,
            'transition-all duration-200',
          )}>
          <div className={css.listingCardInfo} onClick={viewListingDetail}>
            <div className={css.headerRow}>
              <h6 className={css.title}>{title}</h6>
              <div className={css.actionButtons}>
                <div className="flex items-center gap-2">
                  {(selection.isFoodSelected || isSelected) && (
                    <span
                      className={classNames(css.removeDish, css.flip)}
                      onClick={(e) => {
                        e.stopPropagation();
                        selection.handleRemoveFromCart();
                      }}
                      title={selection.getRemoveDishTooltip()}>
                      <FiCheck className="w-5 h-5" strokeWidth={3} />
                    </span>
                  )}
                  {isAllowAddSecondaryFood && (
                    <>
                      {dualFoodSelection.canShowAddAsSecondFood &&
                        !dualFoodSelection.isSecondaryAddDisabled && (
                          <span
                            className={classNames(
                              css.addDish,
                              'ml-auto',
                              dualFoodSelection.isSecondaryAddDisabled &&
                                css.selectDisabled,
                            )}
                            onClick={
                              dualFoodSelection.isSecondaryAddDisabled
                                ? undefined
                                : (e) => {
                                    e.stopPropagation();
                                    dualFoodSelection.handleAddToCart();
                                  }
                            }
                            title={
                              dualFoodSelection.isSecondaryAddDisabled
                                ? 'Không thể chọn thêm món này'
                                : 'Thêm món này lần nữa (x2 định lượng)'
                            }>
                            <FiPlus className="w-5 h-5" strokeWidth={3} />
                          </span>
                        )}
                      {dualFoodSelection.canShowAddSecondOption && (
                        <span
                          className={classNames(
                            css.addDish,
                            dualFoodSelection.isSecondaryAddDisabled &&
                              css.selectDisabled,
                          )}
                          onClick={
                            dualFoodSelection.isSecondaryAddDisabled
                              ? undefined
                              : (e) => {
                                  e.stopPropagation();
                                  dualFoodSelection.handleAddToCart();
                                }
                          }
                          title={
                            dualFoodSelection.isSecondaryAddDisabled
                              ? 'Không thể chọn thêm món thứ 2'
                              : 'Thêm món thứ 2 (tùy chọn)'
                          }>
                          <FiPlus className="w-5 h-5" strokeWidth={3} />
                        </span>
                      )}
                      {dualFoodSelection.canShowPrimaryAdd && (
                        <span
                          className={classNames(
                            css.addDish,
                            dualFoodSelection.isPrimaryAddDisabled &&
                              css.selectDisabled,
                          )}
                          onClick={
                            dualFoodSelection.isPrimaryAddDisabled
                              ? undefined
                              : (e) => {
                                  e.stopPropagation();
                                  dualFoodSelection.handleAddToCart();
                                }
                          }
                          title={
                            dualFoodSelection.isPrimaryAddDisabled
                              ? 'Không thể chọn món này'
                              : 'Thêm món'
                          }>
                          <FiPlus className="w-5 h-5" strokeWidth={3} />
                        </span>
                      )}
                    </>
                  )}
                  {/* Logic cho single food selection */}
                  {!isAllowAddSecondaryFood &&
                    singleFoodSelection.canShowAddButton && (
                      <span
                        className={classNames(css.addDish)}
                        onClick={
                          singleFoodSelection.isAddDisabled
                            ? undefined
                            : (e) => {
                                e.stopPropagation();
                                singleFoodSelection.handleAddToCart();
                              }
                        }
                        title={
                          singleFoodSelection.isAddDisabled
                            ? 'Không thể chọn món này'
                            : 'Thêm món'
                        }>
                        <FiPlus className="w-5 h-5" strokeWidth={3} />
                      </span>
                    )}
                </div>
              </div>
            </div>
            <div className="flex items-center md:gap-2 font-bold text-xs">
              <div className={css.categories}>
                <Badge
                  className="rounded-full"
                  label={getLabelByKey(FOOD_TYPE_OPTIONS, foodType)}
                  type={EBadgeType.success}
                />
              </div>

              {numberOfMainDishes === 1 && isAllowAddSecondaryFood && (
                <div className={css.categories}>
                  <Badge
                    className="rounded-full"
                    label="Chọn 1 món"
                    type={EBadgeType.success}
                  />
                </div>
              )}
            </div>
            <p className={css.description}>{description}</p>
            <div className="flex items-center gap-2 mt-1">
              {isAllowAddSecondaryFood &&
                dualFoodSelection.isFirstFoodSelected && (
                  <Badge
                    className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded-xl"
                    label="Món 1"
                    type={EBadgeType.info}
                  />
                )}
              {isAllowAddSecondaryFood &&
                dualFoodSelection.isSecondFoodSelected && (
                  <Badge
                    className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded-xl"
                    label="Món 2"
                    type={EBadgeType.info}
                  />
                )}
            </div>
          </div>
          <RenderWhen condition={allergicIngredients.length > 0}>
            <div className={css.listingCardFooter}>
              <p className={css.allergiesLabel}>
                {allergicIngredients
                  .map((item: string) => `Có ${item}`)
                  .join(', ')}
              </p>
            </div>
          </RenderWhen>
        </div>
      </div>
      <ListingDetailModal
        listing={listing}
        isOpen={detailModalController.value}
        title={title}
        onClose={handleCloseListingDetailModal}
        onChangeRequirement={selection.handleChangeRequirement}
        requirement={
          isAllowAddSecondaryFood
            ? dualFoodSelection.isSecondFoodSelected
              ? dualFoodSelection.storedSecondRequirement
              : dualFoodSelection.storedRequirement
            : singleFoodSelection.requirement || ''
        }
        onSelectFood={handleSelectFoodInModal}
      />
    </div>
  );
};

export default ListingCard;
