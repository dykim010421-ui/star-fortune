// Lucide 아이콘 → SVG 문자열 (트리셰이킹을 위해 필요한 것만 import)
import {
  Cake, Menu, X, Pause, Play, Sparkles, ArrowLeft, Share2, Download, Moon, Sun, Orbit,
  Heart, Briefcase, Clover, HeartPulse, ChevronRight, Telescope, Quote, Gem, Palette, Hash,
  AArrowUp, AArrowDown, Users, Wallet, Check, CircleSlash, Clock, Compass, Sunrise, Sunset, MoonStar, ChevronDown, Link2,
} from 'lucide';

const ICONS = {
  cake: Cake, menu: Menu, x: X, pause: Pause, play: Play, sparkles: Sparkles, 'arrow-left': ArrowLeft,
  share: Share2, download: Download, moon: Moon, sun: Sun, orbit: Orbit, heart: Heart,
  briefcase: Briefcase, clover: Clover, 'heart-pulse': HeartPulse, 'chevron-right': ChevronRight,
  telescope: Telescope, quote: Quote, gem: Gem, palette: Palette, hash: Hash,
  'font-up': AArrowUp, 'font-down': AArrowDown, users: Users, wallet: Wallet, check: Check,
  slash: CircleSlash, clock: Clock, compass: Compass, sunrise: Sunrise, sunset: Sunset, 'moon-star': MoonStar,
  'chevron-down': ChevronDown, link: Link2,
};

export function icon(name, size = 18) {
  const node = ICONS[name];
  if (!node) return '';
  const inner = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

/** [data-icon] 속성을 가진 요소에 아이콘 채우기 */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon, +(el.dataset.size || 18));
  });
}
