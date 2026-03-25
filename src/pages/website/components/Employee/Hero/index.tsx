import { useMemo, useState } from 'react';
import { PiPlayCircleThin } from 'react-icons/pi';
import { useIntl } from 'react-intl';
import Image from 'next/image';

import { useViewport } from '@hooks/useViewport';

import image from '../../../assets/com-trua-van-phong-pito-cloud-canteen.webp';
import blue2 from '../../../assets/decorations/blue2.svg';
import lemon from '../../../assets/decorations/lemon.svg';
import HeroVideoModal from '../../HeroVideoModal';
import VideoSection from '../../VideoSection';

import styles from './styles.module.css';

const Hero = () => {
  const intl = useIntl();

  const {
    viewport: { width },
  } = useViewport();

  const [isModalHeroOpen, setIsModalHeroOpen] = useState(false);

  const videoUrl = useMemo(
    () =>
      intl.locale === 'vi'
        ? 'https://pito-test-bucket.s3.ap-southeast-2.amazonaws.com/gioi-thieu-pcc.mp4'
        : 'https://pito-test-bucket.s3.ap-southeast-2.amazonaws.com/introduction-pcc.mp4',
    [intl.locale],
  );

  const inlineEmbedUrl = useMemo(() => videoUrl, [videoUrl]);

  const modalEmbedUrl = useMemo(() => videoUrl, [videoUrl]);

  const isMobile = typeof width === 'number' && width <= 768;

  return (
    <>
      <div className="w-full md:min-h-[70vh] relative">
        <div className="flex md:flex-row flex-col items-center md:justify-start justify-center md:py-20 mb-5 md:mb-0 max-w-[1024px] mx-auto md:px-0 px-5">
          <div className="flex flex-col md:items-start items-center md:text-left text-center md:gap-5 gap-2 md:w-[65%] pt-0">
            <span className="font-medium">
              {intl.formatMessage({ id: 'delicious-on-time-your-choice' })}
            </span>

            <h1 className="font-semibold text-2xl md:text-[40px] font-[unbounded] md:leading-tight md:whitespace-pre-line">
              {intl.formatMessage({
                id: 'no-more-what-should-i-eat-for-lunch-today',
              })}
            </h1>

            <span className="text-text md:text-lg md:whitespace-pre-line font-medium">
              {intl.formatMessage({
                id: 'at-lunchtime-your-personalized-meal-is-ready-no-waiting-no-mix-ups-no-boring-repeats',
              })}
            </span>

            {!isMobile && (
              <div className="flex md:flex-row flex-col md:items-center items-stretch w-full gap-2 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalHeroOpen(true)}
                  className="capitalize btn border font-[unbounded] border-gray-300 bg-black text-white py-3 px-6 font-semibold hover:opacity-90 transition-all duration-200 hover:scale-[1.01]">
                  {intl.formatMessage({
                    id: 'see-how-pito-cloud-canteen-works',
                  })}
                </button>
              </div>
            )}
          </div>

          {isMobile ? (
            <VideoSection
              embedUrl={inlineEmbedUrl}
              className="w-full md:hidden mt-10"
            />
          ) : (
            <div className="relative md:flex hidden h-full md:w-[45%]">
              <div className="relative aspect-[2997/2443] size-[110%] scale-110 top-0 left-0 transition-all duration-300">
                <Image
                  src={image}
                  alt="Cơm trưa văn phòng Pito Cloud Canteen"
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  priority
                  loading="eager"
                />
                <button
                  type="button"
                  className="absolute inset-0 flex items-center justify-center"
                  onClick={() => setIsModalHeroOpen(true)}>
                  <PiPlayCircleThin className={styles.fadeoutLoop} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* decorations */}
        <div className="aspect-[277/255] h-[65%] z-0 md:top-[10%] xl:-left-[14%] absolute xl:flex hidden rotate-[104deg]">
          <Image src={lemon} alt="lemon decor" fill />
        </div>

        <div className="aspect-[11/8] h-[20%] z-10 md:top-[20%] xl:left-[3%] absolute xl:flex hidden -rotate-[20deg]">
          <Image src={blue2} alt="lemon triangle decor" fill />
        </div>
      </div>
      {/* Modal */}
      {isModalHeroOpen && (
        <div className="fixed inset-0 z-[9999] flex justify-center items-center bg-black/80">
          <HeroVideoModal
            isModalOpen={isModalHeroOpen}
            onClose={() => setIsModalHeroOpen(false)}
            videoComponent={
              <VideoSection
                embedUrl={modalEmbedUrl}
                className="w-full hidden md:block"
              />
            }
          />
        </div>
      )}
    </>
  );
};

export default Hero;
