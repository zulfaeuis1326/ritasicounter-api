import { useEffect, useRef, useState } from "react";

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
    </svg>
  );
}

export default function ShiftRowMenu({ shiftId, isAdmin, onDelete }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(function () {
    if (!open) return;
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return function () { document.removeEventListener("mousedown", handleOutside); };
  }, [open]);

  return (
    <div className="shift-menu-wrap" ref={wrapRef}>
      <button
        className="shift-menu-trigger"
        onClick={function () { setOpen(!open); }}
        aria-label="Menu shift"
        title="Menu"
      >
        <DotsIcon />
      </button>
      {open && (
        <div className="shift-menu-panel">
          <a
            href={"/api/shift/export?shiftId=" + shiftId}
            target="_blank"
            rel="noreferrer"
            className="shift-menu-item"
            onClick={function () { setOpen(false); }}
          >
            <DownloadIcon /> Download
          </a>
          {isAdmin && (
            <button
              className="shift-menu-item shift-menu-item-danger"
              onClick={function () { setOpen(false); onDelete(); }}
            >
              <TrashIcon /> Hapus
            </button>
          )}
        </div>
      )}
    </div>
  );
}
