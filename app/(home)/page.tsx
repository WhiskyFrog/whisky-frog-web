import Image from "next/image";
import Link from "next/link";

const characters = [
  {
    name: "Bramble",
    src: "/brand/characters/bramble-preview.png?v=2",
    className: "wf-bramble-motion z-20 w-[38%]",
  },
  {
    name: "Cooper",
    src: "/brand/characters/cooper-preview.png?v=2",
    className: "wf-cooper-motion z-10 w-[32%]",
  },
  {
    name: "Pip",
    src: "/brand/characters/pip-preview.png?v=2",
    className: "wf-pip-motion z-30 w-[34%]",
  },
];

const actionClassName =
  "inline-flex min-h-11 items-center justify-center rounded-md border-2 px-4 py-2.5 text-center text-sm font-bold transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[#302818]";

export default function Home() {
  return (
    <main
      aria-labelledby="home-heading"
      className="relative min-h-[calc(100svh-4rem)] overflow-x-clip bg-[#F7EAD4] px-5 py-6 text-[#302818] sm:px-8 sm:py-8 lg:px-12"
    >
      <div
        aria-hidden="true"
        className="wf-hero-glow absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(216,168,104,0.3),transparent_34%),linear-gradient(180deg,#FFF5E6_0%,#F3D7AD_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(84,96,42,0)_0%,rgba(84,96,42,0.18)_100%)]"
      />

      <section className="relative mx-auto flex min-h-[calc(100svh-7rem)] max-w-7xl flex-col items-center">
        <h1
          id="home-heading"
          className="text-center text-3xl font-black text-[#3A2A16] sm:text-4xl"
        >
          Whisky Frog
        </h1>

        <div className="wf-frame-enter relative mt-4 flex min-h-[280px] w-full flex-1 items-center justify-center overflow-hidden rounded-md border-2 border-[#D8A868] bg-[#F7EAD4]/80 p-2 shadow-[0_8px_0_rgba(128,88,24,0.16)] sm:min-h-[420px] sm:p-6 lg:min-h-[540px] lg:p-8">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-[60%] bg-[#6F7A36]/12 blur-3xl"
          />
          <div aria-hidden="true" className="wf-dust wf-dust-a" />
          <div aria-hidden="true" className="wf-dust wf-dust-b" />
          <div aria-hidden="true" className="wf-dust wf-dust-c" />

          <div className="relative z-10 flex w-full max-w-5xl items-end justify-center -space-x-4 sm:-space-x-10 lg:-space-x-14">
            {characters.map((character) => (
              <Image
                key={character.name}
                src={character.src}
                alt={character.name}
                width={620}
                height={760}
                priority
                unoptimized
                className={`${character.className} h-auto min-w-0 object-contain drop-shadow-[0_18px_24px_rgba(74,48,20,0.18)]`}
              />
            ))}
          </div>
        </div>

        <nav
          aria-label="홈페이지 주요 기능"
          className="mt-5 flex w-full flex-wrap justify-center gap-3"
        >
          <Link
            href="/markets/muk"
            className={`${actionClassName} border-[#5A3A12] bg-[#5A3A12] text-[#FFF7E8] shadow-[0_5px_0_#2F2114] hover:-translate-y-0.5 hover:bg-[#6B4518] active:translate-y-0.5 active:shadow-[0_2px_0_#2F2114]`}
          >
            마켓 둘러보기
          </Link>
          <Link
            href="/direct-price"
            className={`${actionClassName} border-[#805818] bg-[#F8E7C6] text-[#4B3418] shadow-[0_4px_0_rgba(90,58,18,0.22)] hover:-translate-y-0.5 hover:bg-[#FFEFCF] active:translate-y-0.5 active:shadow-[0_2px_0_rgba(90,58,18,0.22)]`}
          >
            직구가 계산하기
          </Link>
        </nav>
      </section>
    </main>
  );
}
