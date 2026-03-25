import { useMemo, useState } from 'react';
import { PiPlayCircleThin } from 'react-icons/pi';
import { useIntl } from 'react-intl';
import Image from 'next/image';

import { useViewport } from '@hooks/useViewport';
import { useModal } from '@pages/website/pages/Layout';

import image from '../../assets/com-trua-van-phong-pito-cloud-canteen.webp';
import lemon from '../../assets/decorations/lemon.svg';
import pink from '../../assets/decorations/pink.svg';
import yellow from '../../assets/decorations/yellow.svg';
import HeroVideoModal from '../HeroVideoModal';
import VideoSection from '../VideoSection';

import styles from './styles.module.css';

const Hero = () => {
  const intl = useIntl();
  const { setIsModalOpen } = useModal();
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
      <div className="w-full md:min-h-[70vh] md:px-0 px-5 relative container mx-auto">
        <div className="flex md:flex-row md:px-0 flex-col justify-center items-center md:gap-12 gap-8 md:py-20 pt-10 md:h-[70vh]">
          {/* Left copy */}
          <div className="flex flex-col md:items-start items-center md:text-left text-center md:gap-5 gap-2 md:w-1/2 pt-0">
            <span className="text-text font-medium">
              {intl.formatMessage({ id: 'the-lunch-management-platform' })}
            </span>

            <h1 className="font-semibold text-2xl md:text-[40px] font-[unbounded] md:leading-[3rem] md:whitespace-pre-line">
              {intl.formatMessage({
                id: 'streamline-team-meals-simplify-your-workday',
              })}
            </h1>

            <span className="text-text md:text-lg md:whitespace-pre-line font-medium">
              {intl.formatMessage({
                id: 'stop-drowning-in-meal-coordination-pito-cloud-canteen-is-a-tech-powered-platform-that-transforms-workplace-dining-from-a-daily-headache-into-a-strategic-employee-benefit',
              })}
            </span>

            <div className="flex md:flex-row flex-col md:items-center items-stretch w-full gap-2 mt-8">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="capitalize btn border font-[unbounded] border-gray-300 bg-black text-white py-3 px-6 font-semibold hover:opacity-90 transition-all duration-200 hover:scale-[1.01]">
                {intl.formatMessage({ id: 'book-free-consultation-0' })}
              </button>
            </div>
          </div>

          {/* Right media: mobile shows inline video; desktop shows image with play overlay */}
          {isMobile ? (
            <VideoSection
              embedUrl={inlineEmbedUrl}
              className="w-full block md:hidden"
            />
          ) : (
            <div className="relative md:flex hidden h-full">
              <div className="relative aspect-[2997/2443] h-full scale-110 top-0 left-0 transition-all duration-300">
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
                  aria-label={intl.formatMessage({ id: 'play-video' })}
                  className="absolute inset-0 flex items-center justify-center"
                  onClick={() => setIsModalHeroOpen(true)}>
                  <PiPlayCircleThin className={styles.fadeoutLoop} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Decorations */}
        <Image
          src={yellow}
          alt="yellow circle decor"
          className="md:top-4 md:right-[24rem] top-40 md:size-20 size-12 absolute -z-10 md:block hidden"
        />
        <Image
          src={lemon}
          alt="lemon triangle decor"
          className="md:top-0 top-60 -left-24 md:-left-64 size-40 absolute -z-10 md:block hidden"
        />
        <Image
          src={pink}
          alt="pink triangle decor"
          className="md:-bottom-34 md:-left-80 md:bottom-0 bottom-0 md:size-64 size-56 md:rotate-0 rotate-90 absolute -z-20 md:block hidden"
        />
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
