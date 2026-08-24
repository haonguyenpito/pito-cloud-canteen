/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-shadow */
import { useMemo } from 'react';
import type { FormProps, FormRenderProps } from 'react-final-form';
import { Form as FinalForm } from 'react-final-form';
import { useIntl } from 'react-intl';

import Button, { InlineTextButton } from '@components/Button/Button';
import Form from '@components/Form/Form';
import FieldTextInput from '@components/FormFields/FieldTextInput/FieldTextInput';
import IconAdd from '@components/Icons/IconAdd/IconAdd';
import BackdropModal from '@components/Modal/BackdropModal/BackdropModal';
import useBoolean from '@hooks/useBoolean';
import type { TCompanyGroup, TCompanyMemberWithDetails } from '@utils/types';

import FieldCompanyMemberCheckbox from '../FieldCompanyMemberCheckbox/FieldCompanyMemberCheckbox';
import ManageCompanyMembersTable from '../ManageCompanyMembersTable/ManageCompanyMembersTable';

import css from './UpdateCompanyGroupForm.module.scss';

export type TUpdateCompanyGroupFormValues = {
  companyMemberEmails: string[];
  companyGroups: TCompanyGroup[];
  groupName: string;
  groupId: string;
  tempAddedMemberEmails?: string[];
  addedMemberEmails: string[];
  deletedMemberEmails: string[];
};

type TExtraProps = {
  inProgress: boolean;
  formError: any;
  handleCancel: () => void;
  allCompanyMembers: TCompanyMemberWithDetails[];
  selectedCompanyMembers: TCompanyMemberWithDetails[];
  companyId?: string;
};
type TUpdateCompanyGroupFormComponentProps =
  FormRenderProps<TUpdateCompanyGroupFormValues> & Partial<TExtraProps>;
type TUpdateCompanyGroupFormProps = FormProps<TUpdateCompanyGroupFormValues> &
  TExtraProps;

const UpdateCompanyGroupFormComponent: React.FC<
  TUpdateCompanyGroupFormComponentProps
> = (props) => {
  const {
    handleSubmit,
    values,
    form,
    inProgress,
    handleCancel,
    allCompanyMembers,
    selectedCompanyMembers,
    initialValues,
    companyId,
  } = props;
  const {
    companyMemberEmails,
    companyGroups,
    tempAddedMemberEmails = [],
  } = values;

  const { companyMemberEmails: initialCompanyMemberEmails } = initialValues;
  const {
    value: isAddMemberModalOpen,
    setFalse: closeAddMemberModal,
    setTrue: openAddMemberModal,
  } = useBoolean(false);

  const updateDeletedAndAddedMembers = (newMembers: string[]) => {
    const deletedMemberEmails = initialCompanyMemberEmails?.filter(
      (email) => !newMembers?.includes(email),
    );
    const addedMemberEmails = newMembers?.filter(
      (email) => !initialCompanyMemberEmails?.includes(email),
    );
    form.change('deletedMemberEmails', deletedMemberEmails);
    form.change('addedMemberEmails', addedMemberEmails);
  };

  const onRemoveMember = (email: string) => {
    const oldMembers = [...companyMemberEmails];
    const newMembers = oldMembers.filter((member) => member !== email);
    form.change('companyMemberEmails', newMembers);
    form.change('tempAddedMemberEmails', newMembers);
    updateDeletedAndAddedMembers(newMembers);
  };

  const handleAddMembers = () => {
    form.change('companyMemberEmails', tempAddedMemberEmails);
    updateDeletedAndAddedMembers(tempAddedMemberEmails);
    closeAddMemberModal();
  };

  const companyToRenderForTable = useMemo(
    () =>
      selectedCompanyMembers?.filter((member) =>
        companyMemberEmails?.includes(member.email),
      ),
    [
      JSON.stringify(selectedCompanyMembers),
      JSON.stringify(companyMemberEmails),
    ],
  );

  const intl = useIntl();

  return (
    <>
      <Form onSubmit={handleSubmit}>
        <div className={css.formWrapper}>
          <FieldTextInput
            name="groupName"
            id="groupName"
            label={intl.formatMessage({
              id: 'AddCompanyGroupsFormComponent.groupNameLabel',
            })}
            placeholder={intl.formatMessage({
              id: 'AddCompanyGroupsFormComponent.groupNamePlaceholder',
            })}
          />
          <ManageCompanyMembersTable
            companyMembers={
              companyToRenderForTable as TCompanyMemberWithDetails[]
            }
            companyGroups={companyGroups}
            onRemoveMember={onRemoveMember}
            hideRemoveConfirmModal
            companyId={companyId}
            hiddenColumnNames={['groupName', 'allergy', 'nutritions']}
            canRemoveOwner
          />
          <InlineTextButton
            onClick={openAddMemberModal}
            type="button"
            className={css.addMemberButton}>
            <IconAdd className={css.iconAdd} />
            {intl.formatMessage({ id: 'AddCompanyGroupsForm.addMember' })}
          </InlineTextButton>
          <div className={css.actionBtn}>
            <Button
              disabled={inProgress}
              inProgress={inProgress}
              className={css.submitButton}>
              {intl.formatMessage({ id: 'AddCompanyGroupsForm.saveButton' })}
            </Button>
            <Button
              disabled={inProgress}
              onClick={handleCancel}
              className={css.lightButton}
              type="button">
              {intl.formatMessage({ id: 'AddCompanyGroupsForm.cancelButton' })}
            </Button>
          </div>
        </div>
      </Form>
      <BackdropModal
        title={intl.formatMessage({ id: 'AddCompanyGroupsForm.addMember' })}
        isOpen={isAddMemberModalOpen}
        handleClose={closeAddMemberModal}>
        <div className={css.companyWrapper}>
          {allCompanyMembers?.map((member) => (
            <FieldCompanyMemberCheckbox
              key={member.id}
              className={css.checkbox}
              member={member}
              name="tempAddedMemberEmails"
            />
          ))}
        </div>
        <div className={css.actionBtn}>
          <Button
            type="button"
            onClick={handleAddMembers}
            className={css.submitButton}>
            {intl.formatMessage({ id: 'AddCompanyMembersForm.submitButton' })}
          </Button>
          <Button onClick={closeAddMemberModal} type="button">
            {intl.formatMessage({ id: 'AddCompanyMembersForm.cancelButton' })}
          </Button>
        </div>
      </BackdropModal>
    </>
  );
};

const UpdateCompanyGroupForm: React.FC<TUpdateCompanyGroupFormProps> = (
  props,
) => {
  return <FinalForm {...props} component={UpdateCompanyGroupFormComponent} />;
};

export default UpdateCompanyGroupForm;
