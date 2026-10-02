import Marquee from 'react-fast-marquee';
import { useIntl } from 'react-intl';
import Image from 'next/image';

import { useModal } from '@pages/website/pages/Layout';

import pink from '../../assets/decorations/pink.svg';
import yellow2 from '../../assets/decorations/yellow2.svg';
import comHopKemCanhGiaoVanPhong from '../../assets/meal-box-hero/com-hop-kem-canh-giao-van-phong.webp';
import comHopVanPhongGiaoTanNoi from '../../assets/meal-box-hero/com-hop-van-phong-giao-tan-noi.webp';
import giaoComTruaVanPhongChoDoanhNghiep from '../../assets/meal-box-hero/giao-com-trua-van-phong-cho-doanh-nghiep.webp';
import hopComPitoTimeGiaoTanNoi from '../../assets/meal-box-hero/hop-com-pito-time-giao-tan-noi.webp';
import hopComPitoTimeVanPhong from '../../assets/meal-box-hero/hop-com-pito-time-van-phong.webp';
import hopComTruaVanPhongPitoCloudCanteen from '../../assets/meal-box-hero/hop-com-trua-van-phong-pito-cloud-canteen.webp';
import setComTruaVanPhongCaoCap from '../../assets/meal-box-hero/set-com-trua-van-phong-cao-cap.webp';
import setComTruaVanPhongKemTrangMieng from '../../assets/meal-box-hero/set-com-trua-van-phong-kem-trang-mieng.webp';
import suatComTruaVanPhongDongHop from '../../assets/meal-box-hero/suat-com-trua-van-phong-dong-hop.webp';

const HERO_IMAGES = [
  {
    src: hopComTruaVanPhongPitoCloudCanteen,
    alt: 'hop-com-trua-van-phong-pito-cloud-canteen',
  },
  {
    src: setComTruaVanPhongKemTrangMieng,
    alt: 'set-com-trua-van-phong-kem-trang-mieng',
  },
  {
    src: giaoComTruaVanPhongChoDoanhNghiep,
    alt: 'giao-com-trua-van-phong-cho-doanh-nghiep',
  },
  { src: suatComTruaVanPhongDongHop, alt: 'suat-com-trua-van-phong-dong-hop' },
  { src: comHopVanPhongGiaoTanNoi, alt: 'com-hop-van-phong-giao-tan-noi' },
  { src: hopComPitoTimeVanPhong, alt: 'hop-com-pito-time-van-phong' },
  { src: setComTruaVanPhongCaoCap, alt: 'set-com-trua-van-phong-cao-cap' },
  { src: hopComPitoTimeGiaoTanNoi, alt: 'hop-com-pito-time-giao-tan-noi' },
  { src: comHopKemCanhGiaoVanPhong, alt: 'com-hop-kem-canh-giao-van-phong' },
];

const Hero = () => {
  const intl = useIntl();
  const { setIsModalOpen } = useModal();

  return (
    <section className="w-full relative overflow-hidden pt-32 md:pt-20 pb-10 md:pb-12">
      <Image
        src={pink}
        alt="pink decor"
        className="absolute -z-10 opacity-40 size-40 -top-6 -left-16 md:size-72 md:-top-10 md:-left-24"
      />
      <Image
        src={yellow2}
        alt="yellow circle decor"
        className="absolute -z-10 opacity-30 size-32 -top-10 -right-10 md:size-64 md:-top-20 md:-right-16"
      />

      <div className="flex flex-col items-center text-center gap-2 md:gap-5 px-5">
        <h1 className="font-[unbounded] font-bold text-2xl md:text-[40px] leading-[1.4]">
          {intl.formatMessage({ id: 'giai-phap-dat-bua-trua-tu-dong' })},
          <br className="hidden md:block" />{' '}
          {intl.formatMessage(
            { id: 'toi-uu-cho-nhom' },
            {
              highlightVi: <span className="text-[#D680A3]">20–99</span>,
              highlightEn: (
                <span className="text-[#D680A3]">Teams of 20–99</span>
              ),
            },
          )}
        </h1>
        <span className="md:w-[70%] md:whitespace-pre-line md:text-lg font-medium">
          {intl.formatMessage({
            id: 'helps-you-save-time-on-coordination-so-you-can-focus-on-your-work',
          })}
        </span>
        <button
          className="capitalize btn border font-[unbounded] border-gray-300 bg-black text-white py-3 px-6 font-semibold hover:opacity-90 transition-all duration-200 hover:scale-[1.01]"
          onClick={() => {
            setIsModalOpen(true);
          }}>
          {intl.formatMessage({ id: 'get-started' })}
        </button>
      </div>

      <Marquee className="mt-8 md:mt-12" pauseOnHover>
        {HERO_IMAGES.map(({ src, alt }, index) => (
          <div
            key={alt}
            className="relative h-[160px] md:h-[320px] mr-3 md:mr-4 rounded-2xl overflow-hidden"
            style={{ aspectRatio: `${src.width} / ${src.height}` }}>
            <Image
              src={src}
              alt={alt}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 60vw, 30vw"
              priority={index < 3}
            />
          </div>
        ))}
      </Marquee>
    </section>
  );
};

export default Hero;
