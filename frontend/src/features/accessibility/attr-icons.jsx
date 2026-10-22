import {
  Car, DoorOpen, DotsNine, DotsSix, Elevator, Eye, HandGrabbing,
  SpeakerHigh, Toilet, TrendUp, Wheelchair, WheelchairMotion,
} from '@phosphor-icons/react';

/**
 * Simbol untuk sepuluh atribut aksesibilitas.
 *
 * Phosphor, bukan Streamline. Set "Guidance" yang diminta memang lebih indah, tapi ia
 * berlisensi berbayar — memakainya di karya lomba tanpa lisensi adalah risiko yang
 * tidak sepadan, dan itu pertanyaan yang tidak ingin dijawab di depan juri. Phosphor
 * berlisensi MIT, dan ia satu-satunya pustaka gratis yang benar-benar punya Elevator,
 * Wheelchair, dan Toilet sebagai ikon tersendiri — lucide yang sudah kami pakai tidak.
 *
 * Empat dari sepuluh adalah kiasan, bukan gambar harfiah, dan itu ditulis di sini
 * supaya tidak ada yang mengira kami menemukan ikon yang tidak ada:
 *
 *   ramp        -> TrendUp      : bidang miring
 *   handrail    -> HandGrabbing : benda yang dipegang
 *   guiding_block -> DotsSix    : ubin pemandu memang deretan bintil timbul
 *   braille     -> DotsNine     : satu sel braille adalah kisi titik
 *
 * Yang lain harfiah. Ikon di sini SELALU dekoratif: tiap barisnya sudah punya nama
 * atribut sebagai teks, jadi semuanya aria-hidden dan tidak menambah apa pun untuk
 * pembaca layar — menambahkannya justru membuat tiap baris terbaca dua kali.
 */
const IKON = {
  ramp: TrendUp,
  accessible_entrance: DoorOpen,
  lift: Elevator,
  wheelchair_path: WheelchairMotion,
  handrail: HandGrabbing,
  guiding_block: DotsSix,
  braille: DotsNine,
  audio_access: SpeakerHigh,
  accessible_toilet: Toilet,
  accessible_parking: Car,
};

/** Ikon preset kebutuhan (kartu "Apa yang Anda butuhkan?"). */
export const IKON_PRESET = { kursi_roda: Wheelchair, netra: Eye };

export function IkonAtribut({ code, size = 20, className = '' }) {
  const Ikon = IKON[code];
  if (!Ikon) return null;
  // weight="regular": satu bobot untuk semua, karena ikon di sini berdampingan dengan
  // ikon lucide di tempat lain dan bobot tebal membuat keduanya terlihat dari dua set.
  return <Ikon aria-hidden="true" size={size} weight="regular" className={className} />;
}
