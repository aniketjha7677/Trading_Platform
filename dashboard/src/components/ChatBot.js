import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

import "./ChatBot.css";

const API = "http://localhost:3002";
const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || "http://localhost:3000/login";

const SUGGESTIONS = [
  "Should I buy TCS?",
  "Which stocks look good now?",
  "Review my portfolio",
  "Is HAL good for 1 year?",
];

const VERDICT_CLASS = {
  BUY: "cb-v-buy",
  HOLD: "cb-v-hold",
  WAIT: "cb-v-wait",
  SELL: "cb-v-sell",
  AVOID: "cb-v-sell",
};

const WELCOME = {
  id: 0,
  from: "bot",
  text:
    "Hi! I'm your VeloTrade assistant. Ask me whether to buy, sell or hold a stock, and for how long. " +
    "I look at the price trend and at what you already own.",
};

const ChatIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6a.6.6 0 0 1-1-.46V16A2.5 2.5 0 0 1 4 13.5v-8Z"
      fill="#fff"
    />
    <path
      d="M12 6.2l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z"
      fill="#387ed1"
    />
  </svg>
);

const ChatBot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastStock, setLastStock] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef(null);

  // is an AI model connected on the server?
  useEffect(() => {
    if (!open) return;
    axios
      .get(`${API}/chat/status`)
      .then((res) => setAiEnabled(!!res.data.aiEnabled))
      .catch(() => setAiEnabled(false));
  }, [open]);

  // keep the newest message in view
  useEffect(() => {
    if (open && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, busy, open]);

  const addMessage = (msg) =>
    setMessages((m) => [...m, { id: nextId.current++, ...msg }]);

  const send = async (text) => {
    const content = (text !== undefined ? text : input).trim();
    if (!content || busy) return;

    setInput("");
    addMessage({ from: "user", text: content });
    setBusy(true);

    try {
      const res = await axios.post(
        `${API}/chat`,
        { message: content, lastStock },
        { withCredentials: true, timeout: 60000 }
      );
      const data = res.data;

      if (data.stock) setLastStock(data.stock);
      addMessage({
        from: "bot",
        text: data.reply,
        verdict: data.verdict,
        stock: data.stock,
        disclaimer: data.disclaimer,
      });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        addMessage({
          from: "bot",
          text: "Please log in to chat with the assistant.",
          login: true,
        });
      } else {
        addMessage({
          from: "bot",
          text:
            err.response?.data?.message ||
            "Sorry, I couldn't answer that right now. Please try again in a moment.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([WELCOME]);
    setLastStock("");
  };

  return (
    <>
      {open && (
        <div className="cb-panel" role="dialog" aria-label="VeloTrade assistant">
          <div className="cb-header">
            <div className="cb-header-icon">
              <ChatIcon />
            </div>
            <div className="cb-header-text">
              <strong>VeloTrade Assistant</strong>
              <span>
                {aiEnabled ? "AI-powered" : "Stock guidance"} · for information only
              </span>
            </div>
            <button className="cb-icon-btn" onClick={clearChat} title="Clear chat">
              ⟲
            </button>
            <button
              className="cb-icon-btn"
              onClick={() => setOpen(false)}
              title="Close"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div className="cb-messages">
            {messages.map((m) => (
              <div key={m.id} className={`cb-row cb-row-${m.from}`}>
                <div className="cb-bubble">
                  {m.verdict && (
                    <span className={`cb-verdict ${VERDICT_CLASS[m.verdict] || ""}`}>
                      {m.stock} · {m.verdict}
                    </span>
                  )}
                  <div className="cb-text">{m.text}</div>
                  {m.login && (
                    <a className="cb-login" href={LOGIN_URL}>
                      Login
                    </a>
                  )}
                  {m.disclaimer && <div className="cb-disclaimer">{m.disclaimer}</div>}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="cb-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {busy && (
              <div className="cb-row cb-row-bot">
                <div className="cb-bubble cb-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          <div className="cb-input">
            <textarea
              rows={1}
              placeholder="Ask about a stock, e.g. Should I buy TCS?"
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button onClick={() => send()} disabled={busy || !input.trim()}>
              Send
            </button>
          </div>

          <div className="cb-footer">
            Advice only · not a guarantee. Do your own research.
          </div>
        </div>
      )}

      <button
        className={`cb-launcher ${open ? "cb-launcher-open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        title="Ask the VeloTrade assistant"
      >
        {open ? <span className="cb-x">✕</span> : <ChatIcon />}
      </button>
    </>
  );
};

export default ChatBot;