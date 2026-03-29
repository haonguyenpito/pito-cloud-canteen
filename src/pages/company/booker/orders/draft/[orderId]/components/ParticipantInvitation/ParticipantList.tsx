import { useState } from 'react';

import AlertModal from '@components/Modal/AlertModal';
import ParticipantCard from '@components/OrderDetails/EditView/ManageParticipantsSection/ParticipantCard';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { Listing, User } from '@src/utils/data';
import { buildFullName } from '@src/utils/emailTemplate/participantOrderPicking';
import type { TObject, TUser } from '@src/utils/types';

import {
  BookerDraftOrderPageActions,
  BookerDraftOrderPageThunks,
} from '../../BookerDraftOrderPage.slice';

import css from './ParticipantList.module.scss';

type TParticipantListProps = {};

const ParticipantList: React.FC<TParticipantListProps> = () => {
  const dispatch = useAppDispatch();
  const deleteParticipantControl = useBoolean();
  const [currentParticipantId, setCurrentParticipantId] = useState<string>();
  const participantData = useAppSelector(
    (state) => state.BookerDraftOrderPage.participantData,
  );
  const order = useAppSelector((state) => state.Order.order);

  const orderGetter = Listing(order);

  const { nonAccountEmails = [] } = orderGetter.getMetadata();

  const handleDeleteParticipant = (userId: string) => () => {
    setCurrentParticipantId(userId);
    deleteParticipantControl.setTrue();
  };

  const handleCancelDeleteParticipant = () => {
    deleteParticipantControl.setFalse();
    setCurrentParticipantId(undefined);
  };

  const handleConfirmDeleteParticipant = () => {
    if (currentParticipantId) {
      dispatch(
        BookerDraftOrderPageThunks.deleteOrderParticipants({
          participantId: currentParticipantId,
        }),
      );
      const deletedParticipant = participantData.find(
        (p) => p.id.uuid === currentParticipantId,
      );
      if (deletedParticipant) {
        dispatch(
          BookerDraftOrderPageActions.setRemovedParticipantData(
            deletedParticipant,
          ),
        );
      }
    }
    deleteParticipantControl.setFalse();
  };

  return (
    <div className={css.root}>
      <div className={css.participantContainer}>
        {nonAccountEmails.map((email: string) => {
          return <ParticipantCard key={email} email={email} />;
        })}
        {participantData.map((p: TObject) => {
          const participantGetter = User(p as TUser);
          const participantId = participantGetter.getId();
          const { firstName, lastName, displayName } =
            participantGetter.getProfile();
          const { email } = participantGetter.getAttributes();

          return (
            <ParticipantCard
              key={participantId}
              name={buildFullName(firstName, lastName, {
                compareToGetLongerWith: displayName,
              })}
              email={email}
              participant={p as TUser}
              ableToRemove
              onClickDeleteIcon={handleDeleteParticipant(participantId)}
            />
          );
        })}
      </div>

      <AlertModal
        title="Xoá thành viên"
        containerClassName={css.confirmDeleteModalContainer}
        childrenClassName={css.confirmDeleteModalChildrenContainer}
        isOpen={deleteParticipantControl.value}
        cancelLabel="Huỷ"
        confirmLabel="Xoá thành viên"
        handleClose={handleCancelDeleteParticipant}
        onCancel={handleCancelDeleteParticipant}
        shouldFullScreenInMobile={false}
        onConfirm={handleConfirmDeleteParticipant}>
        Bạn có chắc chắn muốn xoá thành viên này không?
      </AlertModal>
    </div>
  );
};

export default ParticipantList;
