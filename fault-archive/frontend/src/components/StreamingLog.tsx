import { RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { StreamStatus } from "../hooks/useArchiveStream";
import { useTypewriter } from "../hooks/useTypewriter";
import type { ThemeName } from "./ThemeSwitcher";

type Props = { theme: ThemeName; text: string; status: StreamStatus; error: string; outputRef: RefObject<HTMLDivElement> };

const statusLabels: Record<StreamStatus, string> = {
  idle: "AWAITING INPUT",
  connecting: "ESTABLISHING TIMELINE",
  streaming: "REWRITING HISTORY",
  complete: "RECORD SEALED",
  error: "SIGNAL LOST",
};

export default function StreamingLog({ theme, text, status, error, outputRef }: Props) {
  const busy = status === "connecting" || status === "streaming";
  const visibleText = useTypewriter(text, theme === "paper" ? 22 : 12);
  return (
    <motion.section className={`output-panel panel output-panel--${theme}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.18 }}>
      <div className="panel-kicker">
        <span className="eyebrow-index">02 / COUNTER-HISTORY</span>
        <span className={`stream-status stream-status--${status}`}><i /> {statusLabels[status]}</span>
      </div>
      <div className="output-title-row">
        <div><span className="output-overline">THE OTHER SIDE OF THE STORY</span><h2>逆向历史</h2></div>
        {theme === "paper" && <div className="secret-stamp" aria-label="绝密">绝<br />密</div>}
        {theme === "holo" && <span className="holo-index">FA—∞</span>}
      </div>
      <div className={`archive-sheet archive-sheet--${theme}`} ref={outputRef}>
        <div className="sheet-meta"><span>ARCHIVE / {theme === "paper" ? "DECLASSIFIED" : "TIMELINE-0X"}</span><span>{new Date().getFullYear()} · UNVERIFIED</span></div>
        <div className="sheet-rule" />
        <AnimatePresence mode="wait">
          {busy && !text && (
            <motion.div key={`loader-${theme}`} className={`loading-scene loading-scene--${theme}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {theme === "cyber" ? (
                <div className="matrix-rain" aria-label="正在解构时间线">
                  {"010101101001011010010101".split("").map((digit, index) => <i key={index} style={{ animationDelay: `${index * -0.13}s` }}>{digit}</i>)}
                </div>
              ) : theme === "paper" ? (
                <div className="ink-loader"><i /><span>墨迹正在渗入历史...</span></div>
              ) : (
                <div className="holo-loader"><i /><i /><i /><span>SCANNING ALTERNATE TIMELINE</span></div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {!text && !busy && !error && <div className="empty-state"><span className="empty-mark">∅</span><p>此处暂时没有历史。<br />提交一条事实，开始制造偏差。</p><span className="empty-coordinate">COORDINATES: UNKNOWN</span></div>}
        {error && <div className="error-state" role="alert"><span>⚠ TIMELINE CONNECTION FAILED</span><p>{error}</p><small>请确认后端服务已启动，并检查 VITE_ARCHIVE_STREAM_URL。</small></div>}
        {visibleText && (
          <motion.div className={`archive-copy archive-copy--${theme}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: theme === "holo" ? 0.35 : 0.08 }}>
            <p>{visibleText}</p>{(busy || visibleText.length < text.length) && <span className="typing-cursor" aria-hidden="true" />}
          </motion.div>
        )}
        <div className="sheet-footer"><span>END OF AVAILABLE TRUTH</span><span>↘</span></div>
      </div>
      <div className="output-foot"><span><i className="foot-dot" /> ALL TIMELINES ARE FICTIONAL</span>{status === "complete" && <span className="sealed-label">SEALED WITH DOUBT</span>}</div>
    </motion.section>
  );
}