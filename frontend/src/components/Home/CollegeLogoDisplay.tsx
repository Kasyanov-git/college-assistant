import React, { useState } from 'react';
import { KIOSK_CONFIG } from '../../config/kiosk';
import { CollegeLogo } from '../icons/KioskIcons';

/**
 * Блок под логотип колледжа.
 * Положите файл: frontend/public/images/college-logo.png (см. kiosk.ts → collegeLogoImage)
 */
export const CollegeLogoDisplay: React.FC = () => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="college-logo-slot shrink-0" aria-hidden>
      <div className="college-logo-ring" />
      <div className="college-logo-inner">
        {!imgFailed ? (
          <img
            src={KIOSK_CONFIG.collegeLogoImage}
            alt=""
            className="w-full h-full object-contain p-3"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <CollegeLogo className="w-[70%] h-[70%]" />
        )}
      </div>
    </div>
  );
};
