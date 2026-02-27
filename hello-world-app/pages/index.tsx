import Head from "next/head";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Head>
        <title>Conference Icebreaker</title>
      </Head>
      <h1 className="text-5xl font-bold text-slate-800 tracking-tight">Conference Icebreaker</h1>
      <p className="mt-4 text-slate-600 text-lg">Welcome. Organizers: manage your event from the admin panel.</p>
      <Link href="/admin" className="mt-6 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
        Admin Panel
      </Link>
    </div>
  );
}
