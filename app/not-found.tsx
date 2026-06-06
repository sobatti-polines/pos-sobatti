import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[100dvh] bg-[#1c1e54] text-white w-full">
      <div className="flex flex-col items-center max-w-md px-6 text-center pb-24">
        {/* 404 Headline */}
        <h1 
          className="font-sans font-light text-[80px] leading-[1.03] tracking-[-2px] sm:text-[120px] sm:tracking-[-3px] text-white m-0"
          style={{ fontFeatureSettings: '"ss01" on' }}
        >
          404
        </h1>
        
        {/* Sub-headline */}
        <p 
          className="font-sans font-light text-[18px] sm:text-[22px] leading-[1.4] tracking-[-0.22px] mt-2 mb-10 text-[#a8c3de]"
          style={{ fontFeatureSettings: '"ss01" on' }}
        >
          Page not found
        </p>

        {/* Primary Pill Button */}
        <Link 
          href="/dashboard"
          className="inline-flex items-center justify-center bg-[#533afd] text-white hover:bg-[#2e2b8c] active:bg-[#2e2b8c] transition-colors duration-200 text-[16px] leading-none px-[24px] py-[12px] rounded-full font-sans font-normal shadow-[0_1px_3px_rgba(0,55,112,0.08)] hover:shadow-[0_8px_24px_rgba(0,55,112,0.08),0_2px_6px_rgba(0,55,112,0.04)] hover:-translate-y-[1px]"
          style={{ fontFeatureSettings: '"ss01" on' }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
