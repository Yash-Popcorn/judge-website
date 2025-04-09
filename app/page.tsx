import Link from 'next/link';

export default function Home() {
  return (
    <section className="bg-[#FFFFFF] text-white">
      <div className="mx-auto max-w-screen-xl px-4 py-32 lg:flex lg:h-screen lg:items-center">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-black  font-extrabold  sm:text-5xl">
            JUDGE AGENT
          </p>

          <p className="mx-auto mt-4 max-w-xl sm:text-xl/relaxed text-black font-semibold">
            An agent with an Experimental AI Agent that performs tasks
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              className="block w-full rounded-xl font-semibold bg-black px-12 py-3 text-sm font-medium text-white hover:bg-slate-800 hover:text-white focus:outline-none focus:ring active:text-opacity-75 sm:w-auto"
              href="/chat"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
