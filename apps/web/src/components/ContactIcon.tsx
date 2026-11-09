import {
  SiBilibili,
  SiBluesky,
  SiDiscord,
  SiGithub,
  SiInstagram,
  SiSinaweibo,
  SiTelegram,
  SiX,
  SiXiaohongshu,
  SiYoutube
} from "@icons-pack/react-simple-icons";
import type { ContactIconName } from "@liam-frost/shared";

type GlyphProps = { size: number; title: string; "aria-hidden": true };

/** Simple Icons has no LinkedIn mark; this one is Devicon's (MIT), drawn the same way. */
function LinkedInMark({ size, title: _title, ...rest }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="currentColor" {...rest}>
      <path d="M116 3H12a8.91 8.91 0 00-9 8.8v104.42a8.91 8.91 0 009 8.78h104a8.93 8.93 0 009-8.81V11.77A8.93 8.93 0 00116 3zM39.17 107H21.06V48.73h18.11zm-9-66.21a10.5 10.5 0 1110.49-10.5 10.5 10.5 0 01-10.54 10.48zM107 107H88.89V78.65c0-6.75-.12-15.44-9.41-15.44s-10.87 7.36-10.87 15V107H50.53V48.73h17.36v8h.24c2.42-4.58 8.32-9.41 17.13-9.41C103.6 47.28 107 59.35 107 75z" />
    </svg>
  );
}

const GLYPHS: Record<ContactIconName, (props: GlyphProps) => React.ReactNode> = {
  github: SiGithub,
  instagram: SiInstagram,
  linkedin: LinkedInMark,
  x: SiX,
  youtube: SiYoutube,
  telegram: SiTelegram,
  bluesky: SiBluesky,
  discord: SiDiscord,
  bilibili: SiBilibili,
  weibo: SiSinaweibo,
  xiaohongshu: SiXiaohongshu
};

/** One colour (the text's), one size: the link around it supplies the name. */
export default function ContactIcon({ icon, size = 20 }: { icon: ContactIconName; size?: number }) {
  const Glyph = GLYPHS[icon];
  return <Glyph size={size} title="" aria-hidden />;
}
