import Image from "next/image";
import Link from "next/link";

const values = [
  {
    title: "Good Whisky",
    body: "좋은 한 잔은 어렵지 않아도 됩니다. 취향에 맞는 순간을 찾으면 충분합니다.",
  },
  {
    title: "Good Friends",
    body: "Whisky Frog는 혼자 정답을 맞히는 곳보다, 함께 취향을 나누는 공간에 가깝습니다.",
  },
  {
    title: "Good Time",
    body: "서두르지 않고 향과 시간을 천천히 즐기는 작은 왕국의 리듬을 담습니다.",
  },
];

const characters = [
  {
    name: "Bramble",
    role: "Enjoy Whisky",
    body: "취향을 존중하는 왕. 첫 잔은 늘 누군가와 함께 나눕니다.",
  },
  {
    name: "Cooper",
    role: "Know Whisky",
    body: "향과 캐스크를 기억하는 바텐더. 필요한 만큼만 차분히 설명합니다.",
  },
  {
    name: "Pip",
    role: "Welcome Guests",
    body: "처음 온 손님에게 가장 먼저 인사하는 집사. 짧은 다리로 바쁘게 환대합니다.",
  },
];

const heroCharacters = [
  {
    name: "Bramble",
    src: "/brand/characters/bramble-preview.png?v=2",
    className: "wf-bramble-motion z-20 w-[38%] min-w-[185px]",
  },
  {
    name: "Cooper",
    src: "/brand/characters/cooper-preview.png?v=2",
    className: "wf-cooper-motion z-10 w-[32%] min-w-[160px]",
  },
  {
    name: "Pip",
    src: "/brand/characters/pip-preview.png?v=2",
    className: "wf-pip-motion z-30 w-[30%] min-w-[150px]",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F7EAD4] text-[#302818]">
      <section className="relative px-5 pb-14 pt-10 sm:px-8 lg:px-12">
        <div className="wf-hero-glow absolute inset-0 bg-[radial-gradient(circle_at_72%_36%,rgba(216,168,104,0.26),transparent_28%),linear-gradient(180deg,#FFF5E6_0%,#F3D7AD_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(84,96,42,0)_0%,rgba(84,96,42,0.18)_100%)]" />

        <div className="relative mx-auto grid min-h-[calc(100vh-120px)] max-w-7xl gap-8 lg:grid-cols-[minmax(420px,0.76fr)_minmax(520px,1fr)] lg:items-center">
          <div className="z-10 max-w-2xl pb-2 pt-8 lg:py-16">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#805818]">
              Whisky Kingdom
            </p>
            <h1 className="text-5xl font-black leading-[0.95] text-[#3A2A16] sm:text-7xl lg:text-8xl">
              Whisky Frog
            </h1>
            <p className="mt-6 max-w-xl text-xl font-semibold text-[#5A421F] sm:text-2xl">
              Good whisky, good friends, good time.
            </p>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#5F4A2F] sm:text-lg">
              A cozy whisky kingdom for finding your next dram. 숲속 작은
              왕국에서 브램블, 쿠퍼, 핍이 당신의 취향과 시간을 천천히 맞이합니다.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
              href="/markets/muk"
                className="rounded-md bg-[#5A3A12] px-5 py-3 text-sm font-bold text-[#FFF7E8] shadow-[0_5px_0_#2F2114] transition hover:-translate-y-0.5 hover:bg-[#6B4518] active:translate-y-0.5 active:shadow-[0_2px_0_#2F2114]"
              >
                마켓 둘러보기
              </Link>
              <Link
                href="/direct-price"
                className="rounded-md border-2 border-[#805818] bg-[#F8E7C6] px-5 py-3 text-sm font-bold text-[#4B3418] shadow-[0_4px_0_rgba(90,58,18,0.22)] transition hover:-translate-y-0.5 hover:bg-[#FFEFCF] active:translate-y-0.5 active:shadow-[0_2px_0_rgba(90,58,18,0.22)]"
              >
                직구가 계산하기
              </Link>
            </div>
          </div>

          <div className="wf-frame-enter relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-md border-2 border-[#D8A868] bg-[#F7EAD4] p-4 shadow-[0_8px_0_rgba(128,88,24,0.16)] lg:min-h-[560px] lg:p-8">
            <div className="absolute inset-x-0 bottom-0 h-[60%] bg-[#6F7A36]/12 blur-3xl" />
            <div className="wf-dust wf-dust-a" />
            <div className="wf-dust wf-dust-b" />
            <div className="wf-dust wf-dust-c" />
            <div className="relative z-10 flex w-full max-w-[900px] items-end justify-center -space-x-8 px-2 sm:-space-x-12 sm:px-6">
              {heroCharacters.map((character) => (
                <Image
                  key={character.name}
                  src={character.src}
                  alt={`${character.name} character preview`}
                  width={620}
                  height={760}
                  priority
                  unoptimized
                  className={`${character.className} h-auto object-contain drop-shadow-[0_18px_24px_rgba(74,48,20,0.18)]`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#FFF8EA] px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {values.map((item) => (
            <article
              key={item.title}
              className="rounded-md border-2 border-[#D8A868] bg-[#FFF2D7] p-5 shadow-[0_4px_0_rgba(128,88,24,0.14)]"
            >
              <h2 className="text-lg font-black text-[#3A2A16]">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#665138]">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#F7EAD4] px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#805818]">
                Royal Tavern
              </p>
              <h2 className="mt-2 text-3xl font-black text-[#302818]">
                오늘의 한 잔을 찾는 세 친구
              </h2>
            </div>
            <Link
              href="/markets/muk"
              className="w-fit rounded-md border-2 border-[#302818] bg-[#302818] px-4 py-2 text-sm font-bold text-[#FFF7E8] hover:bg-[#463722]"
            >
              상품 검색으로 이동
            </Link>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {characters.map((item) => (
              <article
                key={item.name}
                className="rounded-md border-2 border-[#C99B55] bg-[#FFF8EA] p-5"
              >
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9A6A20]">
                  {item.role}
                </p>
                <h3 className="mt-2 text-2xl font-black text-[#302818]">
                  {item.name}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#665138]">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
