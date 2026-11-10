import {practiceIcon} from './practice-icons';
// Reuse original transparent artwork; SVG URLs pass through unchanged.
const originals:Record<string,string>={
  "/practice-icons/commercial-disputes.e781c6e5991e.webp": "/practice-icons/commercial-disputes.png",
  "/practice-icons/labor.5351e1716e14.webp": "/practice-icons/labor.png",
  "/practice-icons/criminal-defense.b564ced99294.webp": "/practice-icons/criminal-defense.png",
  "/practice-icons/civil.50c186278209.webp": "/practice-icons/civil.png",
  "/practice-icons/litigation.d034862fe422.webp": "/practice-icons/litigation.png",
  "/practice-icons/patent.1a2c8ba1883d.webp": "/practice-icons/patent.png",
  "/practice-icons/international-arbitration.49c1f17d26fe.webp": "/practice-icons/international-arbitration.png",
  "/practice-icons/workers-compensation.2c3710a6be5e.webp": "/practice-icons/workers-compensation.png",
  "/practice-icons/personal-injury.98dfc7e04875.webp": "/practice-icons/personal-injury.png",
  "/practice-icons/employment-law.cc6d6fce84d2.webp": "/practice-icons/employment-law.png",
  "/practice-icons/real-estate.4cdb8e358082.webp": "/practice-icons/real-estate.png",
  "/practice-icons/aviation.9827e0fc37b4.webp": "/practice-icons/aviation.png",
  "/practice-icons/immigration.a0416d8a093f.webp": "/practice-icons/immigration.png",
  "/practice-icons/family-law.33a49b8b65a7.webp": "/practice-icons/family-law.png",
  "/practice-icons/estate-planning.7b4beb613e58.webp": "/practice-icons/estate-planning.png",
  "/practice-icons/social-security-disability.5fd960d75a42.webp": "/practice-icons/social-security-disability.png",
  "/practice-icons/intellectual-property.e37c0256e941.webp": "/practice-icons/intellectual-property.png"
};
export function homePracticeIcon(id:string){const src=practiceIcon(id);return originals[src]||src;}
