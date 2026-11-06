import { useEffect, useState, useRef } from "react";

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// Combobox modern: tap buat buka panel, di panel ada search + list yang bisa di-scroll.
// Dipakai di banyak halaman (index, fleet, dll) gantiin <select> bawaan browser yang
// kepanjangan kalau opsinya banyak.
export default function Combobox({ value, onChange, options, placeholder, emptyLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const current = options.find((o) => o.value === value);
  const displayText = current ? current.label : (value === "" && emptyLabel ? emptyLabel : null);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("touchstart", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("touchstart", onClickOutside);
    };
  }, []);

  function openPanel() {
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
  }

  function pick(opt) {
    onChange(opt ? opt.value : "");
    setOpen(false);
    setQuery("");
  }

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div className="combobox" ref={wrapRef}>
      <button type="button" className="combobox-trigger" onClick={openPanel}>
        <span className={displayText ? "combobox-value" : "combobox-placeholder"}>
          {displayText || placeholder || "Pilih..."}
        </span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="combobox-panel">
          <div className="combobox-search-row">
            <SearchIcon />
            <input
              ref={inputRef}
              className="combobox-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
            />
          </div>
          <div className="combobox-list">
            {emptyLabel && (
              <div className="combobox-option combobox-option-muted" onClick={() => pick(null)}>
                {emptyLabel}
              </div>
            )}
            {filtered.map((o) => (
              <div
                key={o.value}
                className={"combobox-option" + (o.value === value ? " combobox-option-active" : "")}
                onClick={() => pick(o)}
              >
                {o.label}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="combobox-empty">Gak ada yang cocok</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
