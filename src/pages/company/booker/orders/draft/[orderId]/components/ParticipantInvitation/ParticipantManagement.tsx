import { useState } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'react-toastify';
import difference from 'lodash/difference';
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';

import Alert, { EAlertPosition, EAlertType } from '@components/Alert/Alert';
import RenderWhen from '@components/RenderWhen/RenderWhen';
import Tracker from '@helpers/tracker';
import { useAppDispatch, useAppSelector } from '@hooks/reduxHooks';
import useBoolean from '@hooks/useBoolean';
import { useViewport } from '@hooks/useViewport';
import {
  filterHasAccountUserIds,
  filterHasAccountUsers,
  filterNoAccountUserEmail,
  useAddMemberEmail,
} from '@pages/company/[companyId]/members/hooks/useAddMemberEmail';
import { Listing } from '@src/utils/data';
import { successToastOptions } from '@src/utils/toastify';
import type { TListing, TObject } from '@src/utils/types';
import { normalizeInviteEmailList } from '@utils/validators';

import { BookerDraftOrderPageThunks } from '../../BookerDraftOrderPage.slice';

import type { TAddParticipantFormValues } from './AddParticipantForm';
import AddParticipantForm from './AddParticipantForm';
import ImportParticipantFromFile from './ImportParticipantFromFile';
import ParticipantList from './ParticipantList';
import RemovedParticipantList from './RemovedParticipantList';

import css from './ParticipantManagement.module.scss';

type TParticipantManagementProps = {};

const ParticipantManagement: React.FC<TParticipantManagementProps> = () => {
  const [message, setMessage] = useState<any>('');
  const dispatch = useAppDispatch();
  const mobileAlertControl = useBoolean();
  const { isMobileLayout } = useViewport();
  const order = useAppSelector((state) => state.Order.order);
  const participantData = useAppSelector(
    (state) => state.BookerDraftOrderPage.participantData,
  );
  const {
    onAddMembersSubmitInQuizFlow: handleAddMemberToCompany,
    checkEmailsList,
  } = useAddMemberEmail({ orderId: order?.id?.uuid });

  const orderGetter = Listing(order as TListing);
  const orderId = orderGetter.getId();
  const { nonAccountEmails = [] } = orderGetter.getMetadata();

  const isParticipantListEmpty = isEmpty(participantData);
  const restrictEmailList = participantData.map((p) => p.attributes.email);

  const intl = useIntl();

  const handleInviteMemberViaEmailList = async (emailList: string[]) => {
    const normalizedEmailList = normalizeInviteEmailList(emailList);
    const normalizedRestrictEmailList =
      normalizeInviteEmailList(restrictEmailList);
    const normalizedNonAccountEmails =
      normalizeInviteEmailList(nonAccountEmails);

    const needInviteEmailList = difference(
      normalizedEmailList,
      normalizedRestrictEmailList.concat(normalizedNonAccountEmails),
    );

    if (!isEmpty(needInviteEmailList)) {
      const newLoadedResult = (await checkEmailsList(
        needInviteEmailList,
      )) as TObject[];

      const newNonAccountEmails = filterNoAccountUserEmail(newLoadedResult);
      const newUserIds = filterHasAccountUserIds(newLoadedResult);
      const newHasCompanyUserIds = filterHasAccountUserIds(
        newLoadedResult,
        false,
        true,
      );
      const newUsers = filterHasAccountUsers(newLoadedResult);

      handleAddMemberToCompany(newLoadedResult as TObject[]);

      const needHandleItems = newUserIds.concat(newNonAccountEmails);

      if (!isEmpty(needHandleItems)) {
        const updatedNonAccountEmails = normalizeInviteEmailList(
          nonAccountEmails.concat(newNonAccountEmails),
        );
        const nonAccountEmailsParamMaybe = isEmpty(newNonAccountEmails)
          ? { nonAccountEmails: normalizeInviteEmailList(nonAccountEmails) }
          : { nonAccountEmails: updatedNonAccountEmails };

        await dispatch(
          BookerDraftOrderPageThunks.addOrderParticipants({
            orderId,
            newUsers,
            newUserIds: newHasCompanyUserIds,
            ...nonAccountEmailsParamMaybe,
          }),
        );

        const newMessage = (
          <span>
            {intl.formatMessage({ id: 'da-them' })}{' '}
            {needHandleItems.length > 1 ? (
              <b>{needHandleItems.length} email</b>
            ) : (
              'email'
            )}{' '}
            {intl.formatMessage({ id: 'vao-danh-sach' })}
          </span>
        );

        setMessage(newMessage);

        if (isMobileLayout) {
          mobileAlertControl.setTrue();
        } else {
          toast(newMessage, successToastOptions);
        }
      }
    }
  };

  const handleSubmitAddParticipant = async ({
    emails,
  }: TAddParticipantFormValues) => {
    const parseEmailList = normalizeInviteEmailList(
      uniq(emails.trim().replace(/\s+/g, ' ').split(' ')),
    );
    Tracker.track('booker:order:add-emails', {
      emails: parseEmailList,
      orderId: order?.id?.uuid,
    });

    await handleInviteMemberViaEmailList(parseEmailList);
  };

  const handleRestoreParticipant = async (emails: string[]) => {
    await handleSubmitAddParticipant({ emails: emails.join(',') });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className={css.root}>
        <div className={css.titleContainer}>
          <div className={css.title}>
            {isMobileLayout
              ? intl.formatMessage({ id: 'danh-sach-thanh-vien' })
              : intl.formatMessage({ id: 'danh-sach-thanh-vien-hien-tai' })}
          </div>
          <RenderWhen condition={!isParticipantListEmpty}>
            <div className={css.count}>{participantData.length}</div>
          </RenderWhen>
        </div>

        <AddParticipantForm
          onSubmit={handleSubmitAddParticipant}
          restrictEmailList={restrictEmailList}
        />
        <RenderWhen condition={isMobileLayout}>
          <RenderWhen.False>
            <ImportParticipantFromFile
              handleInviteMember={handleInviteMemberViaEmailList}
            />
          </RenderWhen.False>
        </RenderWhen>
        <ParticipantList />

        <Alert
          className={css.mobileAlert}
          position={EAlertPosition.bottom}
          onClose={mobileAlertControl.setFalse}
          autoClose
          timeToClose={3000}
          isOpen={mobileAlertControl.value}
          hasCloseButton={false}
          type={EAlertType.success}
          message={message}
          messageClassName={css.mobileAlertMessage}
        />
      </div>
      <RemovedParticipantList onRestoreParticipant={handleRestoreParticipant} />
    </div>
  );
};

export default ParticipantManagement;
