import { useState } from 'react';
import { useIntl } from 'react-intl';
import Image from 'next/image';

import { useViewport } from '@hooks/useViewport';

import image from '../../assets/com-trua-van-phong-pito-cloud-canteen.webp';
import lemon from '../../assets/decorations/lemon.svg';
import pink from '../../assets/decorations/pink.svg';
import HeroVideoModal from '../HeroVideoModal';
import VideoSection from '../VideoSection';

const Hero2 = () => {
  const intl = useIntl();

  const [isModalHeroOpen, setIsModalHeroOpen] = useState(false);

  const {
    viewport: { width },
  } = useViewport();

  return (
    <div className="w-full md:h-full md:px-0 px-5 relative">
      {/* main hero section */}
      <div className="flex md:flex-row relative flex-col-reverse gap-5 items-center justify-center md:pb-32 pt-0 max-w-[1024px] mx-auto">
        {/* lhs */}
        <div className="flex flex-col md:items-start items-center md:text-left text-center md:gap-5 gap-2 w-full md:w-[58%] md:pt-0 pt-16">
          <span className="font-bold font-[unbounded] text-xl md:text-[40px] leading-tight max-w-full md:max-w-none md:whitespace-pre-line">
            {intl.formatMessage({ id: 'smart-delivery-zero-disruption' })}
          </span>
          <span className="md:w-4/5 text-left md:text-left md:text-lg font-medium">
            {intl.formatMessage({
              id: 'see-how-pitos-smart-delivery-system-fits-seamlessly-into-your-teams-daily-rhythm-without-slack-reminders-or-stairwell-drop-offs',
            })}
          </span>
        </div>

        {width <= 768 && (
          <VideoSection
            embedUrl="https://pito-test-bucket.s3.ap-southeast-2.amazonaws.com/gioi-thieu-pcc.mp4"
            className="w-full z-10"
          />
        )}

        <div
          className="relative md:block hidden aspect-[2997/2443] w-full md:w-[42%] scale-100 top-0 right-0 hover:scale-[1.1] transition-all duration-300 cursor-pointer"
          onClick={() => setIsModalHeroOpen(true)}>
          <Image
            src={image}
            alt="Image hero"
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            priority
            loading="eager"
          />
        </div>
      </div>
      {/* decorations */}
      <Image
        src={lemon}
        alt="lemon triangle decor"
        className="md:top-[2rem] md:size-52 size-20 rotate-[15deg] top-0 left-auto md:-left-44 md:right-auto right-5 absolute -z-10"
      />
      <Image
        src={pink}
        alt="pink triangle decor"
        className="md:-bottom-54 md:-left-56 md:-top-60 top-20 md:size-[24rem] size-56 md:-rotate-[110deg] rotate-90 absolute -z-20"
      />
      {isModalHeroOpen && (
        <div className="fixed inset-0 z-[9999] flex justify-center items-center bg-black/80">
          <HeroVideoModal
            isModalOpen={isModalHeroOpen}
            onClose={() => setIsModalHeroOpen(false)}
            videoComponent={
              <VideoSection
                embedUrl="https://pito-test-bucket.s3.ap-southeast-2.amazonaws.com/gioi-thieu-pcc.mp4"
                className="w-full block md:hidden"
              />
            }
          />
        </div>
      )}
    </div>
  );
};

export default Hero2;
