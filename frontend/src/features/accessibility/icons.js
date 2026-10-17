import { GraduationCap, HeartPulse, Landmark, MapPin, Store, TrainFront } from 'lucide-react';

export const CATEGORY_ICON = {
  kesehatan: HeartPulse, pendidikan: GraduationCap, layanan_publik: Landmark, transportasi: TrainFront, komersial: Store,
};
export const categoryIcon = (code) => CATEGORY_ICON[code] ?? MapPin;
