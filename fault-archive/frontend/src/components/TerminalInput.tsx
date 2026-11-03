import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import type { ThemeName } from "./ThemeSwitcher";

type Props = {
  theme: ThemeName;
  busy: boolean;
  onGenerate: (value: string) => void;
  onStop: () => void;
};

const examples = ["重力让苹果从树上掉下来", "恐龙在六千五百万年前灭绝了", "人类第一次登上月球"];

export default function TerminalInput({ theme, busy, onGenerate, onStop }: Props) {
  const [value, setValue] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return onStop();
    if (value.trim()) onGenerate(value.trim());
  }

  return (
    <motion.section className="input-panel panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}>
      <div className="panel-kicker">
        <span className="eyebrow-index">01 / INPUT</span>
        <span className="live-indicator"><i /> READY FOR REVISION</span>
      </div>
      <div className="input-heading">
        <h2>一切荒诞，<br />始于一个事实。</h2>
        <p>给历史一个支点。我们负责把它撬向错误的方向。</p>
      </div>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="truth-input">
          <span>TRUTH INPUT</span><span className="field-counter">{value.length.toString().padStart(2, "0")} / 240</span>
        </label>
        <div className={`textarea-wrap textarea-wrap--${theme}`}>
          <span className="textarea-glyph" aria-hidden="true">{theme === "cyber" ? ">" : theme === "paper" ? "§" : "✳"}</span>
          <textarea
            id="truth-input"
            maxLength={240}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={theme === "cyber" ? "输入一条公认的历史事实..." : "写下一条你深信不疑的事实..."}
            rows={5}
          />
          {theme === "paper" && <span className="paper-corner">CASE FILE № 047-A</span>}
        </div>
        <div className="suggestions">
          <span>TRY A PREMISE</span>
          {examples.map((example) => <button type="button" key={example} onClick={() => setValue(example)}>{example}</button>)}
        </div>
        <motion.button className={`launch-button launch-button--${theme}`} type="submit" disabled={!busy && !value.trim()} whileHover={!busy ? { y: -2 } : undefined} whileTap={{ scale: 0.985 }}>
          <span className="launch-button__icon">{busy ? "Ⅱ" : "↗"}</span>
          <span>{busy ? "中止解构" : "启动解构"}</span>
          <span className="launch-button__arrow">{busy ? "ESC" : "↗"}</span>
        </motion.button>
      </form>
      <div className="input-footnote"><span>NO FACTS WERE HARMED</span><span>FICTION ENGINE v.∞</span></div>
    </motion.section>
  );
}