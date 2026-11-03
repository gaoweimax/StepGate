import { motion } from "framer-motion";

export type ThemeName = "cyber" | "paper" | "holo";
const themes: { id: ThemeName; name: string; caption: string; mark: string }[] = [
  { id: "cyber", name: "赛博终端", caption: "CYBERPUNK", mark: "01" },
  { id: "paper", name: "绝密档案", caption: "TOP SECRET", mark: "02" },
  { id: "holo", name: "极简全息", caption: "HOLOGRAPHIC", mark: "03" },
];

type Props = { theme: ThemeName; onChange: (theme: ThemeName) => void };
export default function ThemeSwitcher({ theme, onChange }: Props) {
  return (
    <nav className="theme-switcher" aria-label="选择视觉主题">
      <span className="theme-switcher__label">SELECT REALITY</span>
      <div className="theme-switcher__options">
        {themes.map((item) => (
          <button className={`theme-option ${theme === item.id ? "is-active" : ""}`} key={item.id} type="button" aria-pressed={theme === item.id} onClick={() => onChange(item.id)}>
            {theme === item.id && <motion.span className="theme-option__active" layoutId="theme-active" transition={{ type: "spring", stiffness: 360, damping: 32 }} />}
            <span className="theme-option__number">{item.mark}</span>
            <span className="theme-option__copy"><strong>{item.name}</strong><small>{item.caption}</small></span>
          </button>
        ))}
      </div>
    </nav>
  );
}
