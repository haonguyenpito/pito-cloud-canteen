import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { Splide, SplideSlide } from '@splidejs/react-splide';
import Image from 'next/image';
import { useRouter } from 'next/router';

import { websitePaths } from '@src/paths';

import image1 from '../assets/pitoAssets/1.webp';
import image4 from '../assets/pitoAssets/3.webp';
import image3 from '../assets/pitoAssets/11.webp';
import image5 from '../assets/pitoAssets/12.webp';

import { ModalForm, ModalFormWithEmployees } from './Modal';

import '@splidejs/react-splide/css';

type ModalProps = {
  onClose: () => void;
  isModalOpen: boolean;
};

const images = [image1, image3, image4, image5];

const ModalAlt = ({ onClose, isModalOpen }: ModalProps) => {
  const intl = useIntl();
  const formHeight = useRef<HTMLDivElement>(null);
  const [heightSlider, setHeightSlider] = useState<string>('0px');
  const router = useRouter();

  // Effect to measure the height of the form and update the slider height
  useEffect(() => {
    if (!isModalOpen) return;

    const measure = () => {
      if (!formHeight.current) return;
      const h = Math.round(formHeight.current.getBoundingClientRect().height);
      setHeightSlider((prev) => (prev === `${h}px` ? prev : `${h}px`));
    };

    let raf1 = 0;
    let raf2 = 0;
    const rafMeasure = () => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(measure);
      });
    };
    rafMeasure();

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && formHeight.current) {
      ro = new ResizeObserver(measure);
      ro.observe(formHeight.current);
    }

    const onResize = () => rafMeasure();
    window.addEventListener('resize', onResize);

    measure();

    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isModalOpen]);

  const formComponent = useMemo(() => {
    if (router.pathname.includes(websitePaths.Employee)) {
      return <ModalFormWithEmployees onClose={onClose} />;
    }

    return <ModalForm onClose={onClose} />;
  }, [router, onClose]);

  if (!isModalOpen) return null;

  return (
    <div
      className={`fixed inset-0 flex justify-center items-start md:items-center p-4 md:p-0 overflow-y-auto transition-all duration-300 ease-in-out ${
        isModalOpen
          ? 'opacity-100 visible bg-black/80 z-[1000]'
          : 'opacity-0 invisible z-10'
      }`}>
      <div
        className={`rounded-none md:rounded-3xl p-0 w-full md:max-w-5xl max-h-full h-fit overflow-y-auto md:w-full relative transition-all duration-300 ease-in-out flex items-stretch ${
          isModalOpen
            ? 'opacity-100 scale-100 visible'
            : 'opacity-0 scale-90 invisible'
        }`}>
        {/* lhs */}
        <div className="bg-white w-[60%] h-fit hidden md:block">
          <Splide
            options={{
              type: 'loop',
              arrows: false,
              autoplay: true,
              interval: 3000,
              pagination: true,
              // cập nhật: truyền thẳng string px
              height: heightSlider,
              width: '100%',
            }}>
            {images.map((image, index) => (
              <SplideSlide key={index}>
                <Image
                  src={image}
                  alt="company"
                  className={`${
                    isModalOpen
                      ? 'size-full object-cover visible'
                      : 'size-0 invisible'
                  }`}
                />
              </SplideSlide>
            ))}
          </Splide>
        </div>

        {/* rhs */}
        <div
          ref={formHeight}
          className="overflow-auto w-full md:w-[45%] flex flex-col p-4 md:p-10 bg-white rounded-3xl md:absolute md:right-0">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-black/50 text-lg font-semibold cursor-pointer hover:text-red-500 transition-colors duration-300 ease-in-out">
            ✕
          </button>

          {/* Heading */}
          <div className="flex flex-col items-center text-center gap-4 mb-6">
            <h2 className="text-2xl md:text-4xl font-bold font-alt leading-snug">
              {intl.formatMessage({ id: 'lets-tailor-your-0' })}
              <br />
              {intl.formatMessage({ id: 'lunch-solution-0' })}
            </h2>
            <p className="text-gray-600">
              {intl.formatMessage({
                id: 'say-goodbye-to-lunch-hassles-well-make-every-meal-easy-and-enjoyable-for-your-team-0',
              })}
            </p>
          </div>

          {/* Form */}

          {formComponent}
        </div>
      </div>
    </div>
  );
};

export default ModalAlt;
