import { FormEvent, useState } from "react";
import { SearchIcon, SheepMark } from "../components/All";
import { apiBaseUrl } from "../apiConfig";

/** Dev posts to the local API so the question can be read without an API Gateway route. */
const askUrl = `${(import.meta.env.VITE_ASK_URL || (import.meta.env.DEV ? "http://127.0.0.1:8765/" : apiBaseUrl)).replace(
  /\/?$/,
  "/"
)}ask`;

export interface AskDraft {
  ok: boolean;
  error?: string;
  name?: string;
  stat?: string;
  agg?: string;
  seasons?: string[];
  filters?: string[];
  stage?: string;
  limit?: number;
  order?: string;
  team?: string;
}

interface Props {
  page: "stats" | "games" | "rank";
  hint: string;
  placeholder: string;
  ariaLabel: string;
  fallback: string;
  ready: (data: AskDraft) => boolean;
  onResult: (data: AskDraft) => void;
}

/** Question box that fills a query form from one sentence. */
const AskBox = ({ page, hint, placeholder, ariaLabel, fallback, ready, onResult }: Props) => {
  const [question, setQuestion] = useState("");
  const [askError, setAskError] = useState("");
  const [asking, setAsking] = useState(false);

  /** Sends the sentence to /ask and runs the query it returns. */
  const handleAsk = async (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || asking) return;
    if (text.length > 200) {
      setAskError("Keep the question to 200 characters.");
      return;
    }
    setAskError("");
    setAsking(true);
    try {
      const response = await fetch(askUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, page }),
      });
      let data: AskDraft;
      try {
        data = (await response.json()) as AskDraft;
      } catch {
        setAskError("Could not read a response from the API.");
        return;
      }
      if (!response.ok || !ready(data)) {
        setAskError(data.error || fallback);
        return;
      }
      onResult(data);
    } catch {
      setAskError("Could not reach the API.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <form className="nl-ask reveal" onSubmit={handleAsk}>
      <div className="nl-ask-label">Ask in words</div>
      <p className="nl-ask-hint">{hint}</p>
      <div className="nl-ask-field">
        <input
          className="nl-ask-input"
          value={question}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          onChange={(event) => {
            setQuestion(event.target.value);
            setAskError("");
          }}
        />
        <button
          type="submit"
          className="nl-ask-search"
          aria-label={asking ? "Searching" : "Search"}
          disabled={asking || question.trim() == ""}
        >
          <SearchIcon size={18} />
        </button>
      </div>
      {askError && (
        <div className="query-error" role="alert">
          <SheepMark size={22} wool="currentColor" face="currentColor" />
          {askError}
        </div>
      )}
    </form>
  );
};

export default AskBox;
