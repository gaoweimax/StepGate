import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import html2canvas from "html2canvas";
import StreamingLog from "./components/StreamingLog";
import ThemeSwitcher, { ThemeName } from "./components/ThemeSwitcher";
import TerminalInput from "./components/TerminalInput";
import { useArchiveStream } from "./hooks/useArchiveStream";

const themeNames: Record<ThemeName, string> = {
  cyber: "CYBERPUNK TERMINAL",
  paper: "VINTAGE TOP SECRET",
  holo: "MINIMALIST HOLOGRAPHIC",
};

export default function App() {
  const [theme, setTheme] = useState<ThemeName>("cyber");
  const [exporting, setExporting] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const { text, status, error, generate, stop } = useArchiveStream();
  const canExport = status === "complete" && Boolean(text) && !exporting;

  async function exportArchive() {
    if (!outputRef.current || !canExport) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(outputRef.current, {
        backgroundColor: theme === "paper" ? "#eee0bf" : theme === "holo" ? "#10152d" : "#07100a",
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `fault-archive-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (reason) {
      console.error("Archive export failed", reason);
      window.alert("档案封存失败，请稍后重试。");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <div className="ambient ambient--one" /><div className="ambient ambient--two" />
      <header className="topbar">
        <a className="brand" href="#" aria-label="Fault Archive 首页">
          <span className="brand-mark"><span>F</span><i /></span>
          <span className="brand-name">FAULT<span>ARCHIVE</span><small>谬误档案馆</small></span>
        </a>
        <div className="topbar-center"><i /> DEPARTMENT OF ALTERNATE HISTORY <span>EST. NEVER</span></div>
        <div className="topbar-right"><span className="clock-label">LOCAL TIME</span><time>{new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" })}</time></div>
      </header>

      <section className="hero">
        <motion.div className="hero-copy" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
          <div className="hero-overline"><span>AN EXPERIMENT IN WRONGNESS</span><i /></div>
          <h1>历史有时，<em>需要</em><br />一个错误的版本。</h1>
          <p>输入确定的事实，解锁不确定的过去。<br className="desktop-break" />每一段逆向历史，都是一次认真的胡说八道。</p>
        </motion.div>
        <div className="hero-side-note"><span>TRUTH IS A<br />TEMPORARY CONDITION.</span><i>↙</i></div>
      </section>

      <div className="theme-row">
        <div className="theme-row__intro"><span>CHANGE THE LENS</span><p>同一段荒诞，三种平行现实。</p></div>
        <ThemeSwitcher theme={theme} onChange={setTheme} />
      </div>

      <div className="workspace-grid">
        <TerminalInput theme={theme} busy={status === "connecting" || status === "streaming"} onGenerate={generate} onStop={stop} />
        <StreamingLog theme={theme} text={text} status={status} error={error} outputRef={outputRef} />
      </div>

      <footer className="page-footer">
        <span>© FAULT ARCHIVE — THE PAST IS A SUGGESTION</span>
        <span className="footer-center"><i /> SYSTEM NOMINAL <b>·</b> REALITY OPTIONAL</span>
        <span>MADE OF MAYBE <span className="footer-star">✳</span></span>
      </footer>

      <AnimatePresence>
        {canExport && (
          <motion.button className="export-button" type="button" onClick={exportArchive} initial={{ opacity: 0, y: 18, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} whileHover={{ y: -3 }}>
            <span className="export-icon">↧</span><span>封存档案<small>{exporting ? "正在生成..." : "EXPORT RECORD"}</small></span>
          </motion.button>
        )}
      </AnimatePresence>
      <div className={`theme-name theme-name--${theme}`} aria-hidden="true">{themeNames[theme]}</div>
    </main>
  );
}
