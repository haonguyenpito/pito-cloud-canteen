import { useIntl } from 'react-intl';
import clsx from 'clsx';
import Image from 'next/image';

import amazon from '../../assets/companies/logo-khach-hang-amazon.svg';
import armor from '../../assets/companies/logo-khach-hang-armor.svg';
import beiersdorf from '../../assets/companies/logo-khach-hang-beiersdorf.svg';
import booking from '../../assets/companies/logo-khach-hang-booking.com.svg';
import britishEmbassy from '../../assets/companies/logo-khach-hang-british-embassy.svg';
import deloitte from '../../assets/companies/logo-khach-hang-deloitte.svg';
import flexport from '../../assets/companies/logo-khach-hang-flexport.svg';
import forbes from '../../assets/companies/logo-khach-hang-forbes.svg';
import groupm from '../../assets/companies/logo-khach-hang-groupm.svg';
import jr286 from '../../assets/companies/logo-khach-hang-jr286.svg';
import kpmg from '../../assets/companies/logo-khach-hang-kpmg.svg';
import lazada from '../../assets/companies/logo-khach-hang-lazada.svg';
import nab from '../../assets/companies/logo-khach-hang-nab.svg';
import nexon from '../../assets/companies/logo-khach-hang-nexon.svg';
import perfettiVanMelle from '../../assets/companies/logo-khach-hang-perfetti-van-melle.svg';
import prudential from '../../assets/companies/logo-khach-hang-prudential.svg';
import shopee from '../../assets/companies/logo-khach-hang-shopee.svg';
import technos from '../../assets/companies/logo-khach-hang-technos.svg';
import tinyFish from '../../assets/companies/logo-khach-hang-tiny_fish.svg';
import vng from '../../assets/companies/logo-khach-hang-vng.svg';

import styles from './styles.module.css';

const companies = [
  { src: amazon, alt: 'logo-khach-hang-amazon' },
  { src: armor, alt: 'logo-khach-hang-armor' },
  { src: beiersdorf, alt: 'logo-khach-hang-beiersdorf' },
  { src: booking, alt: 'logo-khach-hang-booking.com' },
  { src: britishEmbassy, alt: 'logo-khach-hang-british-embassy' },
  { src: deloitte, alt: 'logo-khach-hang-deloitte' },
  { src: flexport, alt: 'logo-khach-hang-flexport' },
  { src: forbes, alt: 'logo-khach-hang-forbes' },
  { src: groupm, alt: 'logo-khach-hang-groupm' },
  { src: jr286, alt: 'logo-khach-hang-jr286' },
  { src: kpmg, alt: 'logo-khach-hang-kpmg' },
  { src: lazada, alt: 'logo-khach-hang-lazada' },
  { src: nab, alt: 'logo-khach-hang-nab' },
  { src: nexon, alt: 'logo-khach-hang-nexon' },
  { src: perfettiVanMelle, alt: 'logo-khach-hang-perfetti-van-melle' },
  { src: prudential, alt: 'logo-khach-hang-prudential' },
  { src: shopee, alt: 'logo-khach-hang-shopee' },
  { src: technos, alt: 'logo-khach-hang-technos' },
  { src: tinyFish, alt: 'logo-khach-hang-tiny_fish' },
  { src: vng, alt: 'logo-khach-hang-vng' },
];

const TrustedCompanies = () => {
  const intl = useIntl();

  return (
    <div className="mx-auto md:px-4 md:pb-16 px-5 pt-16 md:pt-0 flex flex-col gap-5 md:gap-6 items-center overflow-hidden">
      <span className="w-full md:w-2/3 font-medium text-center md:text-lg whitespace-pre-line md:whitespace-normal">
        {intl.formatMessage({
          id: 'trusted-by-vietnams-leading-tech-companies',
        })}
      </span>
      <div className={clsx('flex select-none overflow-hidden', styles.marquee)}>
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className={clsx(
              'flex shrink-0 items-center',
              styles.marquee__group,
            )}>
            {companies.map((logo, index) => (
              <div key={index} className="relative aspect-[2/1] w-[100px]">
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  fill
                  className="object-contain"
                  sizes="100px"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrustedCompanies;
