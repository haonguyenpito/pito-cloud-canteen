import { useEffect, useMemo, useRef, useState } from 'react';
import type { Event } from 'react-big-calendar';
import { useIntl } from 'react-intl';
import { shallowEqual } from 'react-redux';
import classNames from 'classnames';

import Modal from '@components/Modal/Modal';
import SlideModal from '@components/SlideModal/SlideModal';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import { useViewport } from '@hooks/useViewport';
import { SubOrdersThunks } from '@pages/participant/sub-orders/SubOrders.slice';
import { resetImage } from '@redux/slices/uploadImage.slice';
import { ESubOrderTxStatus } from '@src/utils/enums';

import { OrderListThunks } from '../../OrderList.slice';
import type { TRatingSubOrderFormValues } from '../RatingSubOrderForm/RatingSubOrderForm';
import RatingSubOrderForm from '../RatingSubOrderForm/RatingSubOrderForm';

import { RatingSuccessIllustration } from './RatingSuccessIllustration';

import css from './RatingSubOrderModal.module.scss';

type TRatingSubOrderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  selectedEvent: Event | null;
  participantPostRatingInProgress?: boolean;
};
const RatingSubOrderModal: React.FC<TRatingSubOrderModalProps> = (props) => {
  const {
    isOpen,
    onClose,
    currentUserId,
    selectedEvent,
    participantPostRatingInProgress,
  } = props;
  const orders = useAppSelector(
    (state) => state.ParticipantOrderList.orders,
    shallowEqual,
  );
  const [ratingCompletedLevel, setRatingCompletedLevel] = useState<
    'bad' | 'normal' | 'good'
  >();
  const dispatch = useAppDispatch();
  const { isMobileLayout } = useViewport();
  const {
    companyName,
    orderId,
    restaurant,
    timestamp,
    planId,
    foodName,
    secondaryFoodName,
  } = selectedEvent?.resource || {};
  const restaurantId = restaurant?.id;
  const formRef = useRef<any>(null);
  const intl = useIntl();

  /**
   * Reset ratingCompletedLevel when modal is closed
   */
  useEffect(() => {
    if (!isOpen) {
      setRatingCompletedLevel(undefined);
    }
  }, [isOpen]);

  const handleClose = () => {
    dispatch(resetImage());
    formRef.current?.restart();
    onClose();
  };

  const initialValues: TRatingSubOrderFormValues = useMemo(
    () => ({
      general: '',
      food: '',
      packaging: '',
      detailTextRating: '',
      images: [],
    }),
    [],
  );

  const handleSubmit = async (values: TRatingSubOrderFormValues) => {
    const { general, food, packaging, detailTextRating } = values;
    const rating = {
      orderId,
      restaurantId,
      timestamp,
      reviewerId: currentUserId,
      generalRating: +general,
      detailRating: {
        food: {
          rating: +food,
        },
        packaging: {
          rating: +packaging,
        },
      },
    };

    const { meta } = await dispatch(
      OrderListThunks.postParticipantRating({
        companyName,
        rating,
        detailTextRating,
        planId,
      }),
    );

    if (meta.requestStatus === 'fulfilled') {
      setRatingCompletedLevel(
        +general < 3 ? 'bad' : +general < 4 ? 'normal' : 'good',
      );
      dispatch(
        SubOrdersThunks.fetchSubOrdersFromFirebase({
          participantId: currentUserId,
          txStatus: ESubOrderTxStatus.DELIVERED,
          lastRecord: null,
          extraQueryParams: {
            orderId: {
              operator: 'in',
              value: orders.map((order) => order?.id?.uuid),
            },
          },
        }),
      );
      dispatch(resetImage());
      formRef.current?.reset();
    }
  };

  const renderer = ratingCompletedLevel ? (
    <RatingSuccessIllustration
      level={ratingCompletedLevel}
      action={() => {
        handleClose();
      }}
    />
  ) : (
    <RatingSubOrderForm
      onSubmit={handleSubmit}
      initialValues={initialValues}
      inProgress={participantPostRatingInProgress}
      formRef={formRef}
      hideFormTitle={!isMobileLayout}
    />
  );

  if (isMobileLayout)
    return (
      <SlideModal
        id="RatingSubOrderModal"
        isOpen={isOpen}
        onClose={handleClose}>
        {renderer}
      </SlideModal>
    );

  if (isOpen) {
    return (
      <Modal
        id="RatingSubOrderModal"
        isOpen={isOpen}
        handleClose={handleClose}
        containerClassName={classNames(css.modalContainer, '!px-4')}
        title={`${intl.formatMessage({ id: 'danh-gia-mon' })} ${foodName} ${
          secondaryFoodName ? `+ ${secondaryFoodName}` : ''
        }`}>
        {renderer}
      </Modal>
    );
  }

  return null;
};

export default RatingSubOrderModal;
