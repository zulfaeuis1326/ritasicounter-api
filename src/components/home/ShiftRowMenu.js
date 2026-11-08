import { useEffect, useRef, useState } from "react";
import { MoreVertical, Download, Trash2 } from "lucide-react";

function DotsIcon() {
  return <MoreVertical size={18} strokeWidth={2.2} />;
}
function DownloadIcon() {
  return <Download size={15} strokeWidth={2.2} />;
}
function TrashIcon() {
  return <Trash2 size={15} strokeWidth={2.2} />;
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
