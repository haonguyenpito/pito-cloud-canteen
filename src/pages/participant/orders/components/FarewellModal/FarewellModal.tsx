import { FormattedMessage, useIntl } from 'react-intl';
import Image from 'next/image';

import IconClose from '@components/Icons/IconClose/IconClose';
import Modal from '@components/Modal/Modal';

import css from './FarewellModal.module.scss';

type TFarewellModalProps = {
  isOpen: boolean;
  handleClose: () => void;
};

const FarewellModal: React.FC<TFarewellModalProps> = ({
  isOpen,
  handleClose,
}) => {
  const intl = useIntl();

  return (
    <Modal
      id="ParticipantFarewellModal"
      isOpen={isOpen}
      handleClose={handleClose}
      containerClassName={css.modalContainer}
      scrollLayerClassName={css.scrollLayer}
      shouldHideIconClose
      customHeader={
        <div className={css.header}>
          <div className={css.headerImageWrapper}>
            <Image
              src="/static/cover.jpg"
              alt="PITO Cloud Canteen team"
              width={1200}
              height={800}
              className={css.headerImage}
            />
          </div>
          <button
            type="button"
            className={css.closeButton}
            onClick={handleClose}>
            <IconClose />
          </button>
        </div>
      }
      shouldFullScreenInMobile={false}>
      <div className={css.body}>
        <Image
          src="/static/decorator-pink.png"
          alt="decorator"
          width={220}
          height={220}
          className={css.decoratorPink}
        />
        <div className={css.titleRow}>
          <div className={css.title}>
            {intl.formatMessage({ id: 'FarewellModal.title' })}
          </div>
          <Image
            src="/static/loading-asset-4.png"
            alt="smarter"
            width={48}
            height={48}
            className={css.badgeTitle}
          />
        </div>
        <p className={css.description}>
          <FormattedMessage
            id="FarewellModal.description"
            values={{
              b: (chunks: React.ReactNode) => <b>{chunks}</b>,
              br: () => <br />,
            }}
          />
        </p>
        <div className={css.accountNote}>
          <FormattedMessage
            id="FarewellModal.accountNote"
            values={{
              b: (chunks: React.ReactNode) => <b>{chunks}</b>,
              br: () => <br />,
            }}
          />
        </div>
        <div className={css.logoRow}>
          <Image
            src="/static/from-pcc-with-love.png"
            alt="from PITO Cloud Canteen with love"
            width={100}
            height={22}
            className={css.footerLogo}
          />
        </div>
        <Image
          src="/static/loading-asset-1.png"
          alt="on-time"
          width={64}
          height={64}
          className={css.badgeLeft}
        />
        <Image
          src="/static/loading-asset-3.png"
          alt="happier"
          width={64}
          height={64}
          className={css.badgeRight}
        />
      </div>
    </Modal>
  );
};

export default FarewellModal;
