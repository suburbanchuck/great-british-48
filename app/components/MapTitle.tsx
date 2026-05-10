export default function MapTitle() {
  return (
    // top-14 on mobile keeps it below the "X / 48" badge row; sm:top-4 sits level with it on wider screens
    <div className="fixed top-14 sm:top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none">
      <div className="bg-white rounded-2xl shadow px-5 py-3 text-center font-[family-name:var(--font-overpass)] text-[#1f2937] whitespace-nowrap">

        {/* "Gelly & Charlie" — light, reads as a subtitle */}
        <p className="text-[11px] font-light tracking-[0.18em] uppercase leading-none">
          Gelly &amp; Charlie
        </p>

        {/* "on the" — barely-there connector */}
        <p className="text-[8px] font-light tracking-[0.12em] uppercase leading-none opacity-40 my-[5px]">
          on the
        </p>

        {/* "GREAT BRITISH 48" — the hero line */}
        <p className="text-[14px] font-bold tracking-[0.18em] uppercase leading-none">
          Great British 48
        </p>

      </div>
    </div>
  );
}
