import React from 'react';
import { useRouter } from 'next/router';

import css from './Tet2026Button.module.scss';

const Tet2026Button = ({ companyId }: { companyId: string }) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/participant/events/tet-2026/${companyId}`);
  };

  return (
    <div className={css.tetButtonOuter}>
      <div className={css.ambientGlow} />
      <div className={css.rotatingBorderWrapper}>
        <div className={css.rotatingBorder} />
      </div>

      <button className={css.tetButton} onClick={handleClick}>
        <span className={css.buttonInner}>
          <div className={css.mainRow}>
            <div className="flex flex-col">
              <span className={css.tetLabel}>Chúc mừng năm mới</span>
              <span className={css.tetLabel}>Xuân Bính Ngọ</span>
            </div>
          </div>
        </span>
      </button>
    </div>
  );
};

export default Tet2026Button;
