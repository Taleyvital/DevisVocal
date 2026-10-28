// Tape-measure strip used as the recording timer: it unrolls under a fixed
// red marker, one graduation per second, red numbers every minute.

const PX_PER_SECOND = 6;
const LABEL_EVERY = 10; // seconds

export function Tape({ seconds, max }: { seconds: number; max: number }) {
  const labels = [];
  for (let s = 0; s <= max; s += LABEL_EVERY) {
    labels.push(
      <span
        key={s}
        className={`tape-label ${s % 60 === 0 ? "is-minute" : ""}`}
        style={{ left: s * PX_PER_SECOND }}
      >
        {s % 60 === 0 ? `${s / 60}'` : s % 60}
      </span>
    );
  }

  return (
    <div className="tape" aria-hidden>
      <div
        className="tape-strip"
        style={{
          width: max * PX_PER_SECOND + 400,
          transform: `translateX(${-seconds * PX_PER_SECOND}px)`,
        }}
      >
        {labels}
      </div>
      <span className="tape-marker" />
    </div>
  );
}
